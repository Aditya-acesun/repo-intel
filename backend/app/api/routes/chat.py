from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.services.rag_service import generate_answer
from app.services.vectorstore_service import get_or_create_collection
from app.services.embedding_service import embed_texts
from app.api.routes.auth import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.chat_message import ChatMessage
from groq import Groq
from app.core.config import settings
import json

router = APIRouter(prefix="/chat", tags=["Chat"])
_client = Groq(api_key=settings.GROQ_API_KEY)


class ChatRequest(BaseModel):
    repo_name: str
    query: str
    history: Optional[list[dict]] = None


@router.post("/ask")
def ask_question(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = generate_answer(payload.repo_name, payload.query, payload.history)

        db.add(ChatMessage(
            user_id=current_user.id,
            repo_name=payload.repo_name,
            role="user",
            content=payload.query
        ))
        db.add(ChatMessage(
            user_id=current_user.id,
            repo_name=payload.repo_name,
            role="assistant",
            content=result["answer"],
            sources=",".join(result["sources"])
        ))
        db.commit()

        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/stream")
async def stream_question(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.rag_service import retrieve_context, get_similar_files

    context_chunks = retrieve_context(payload.repo_name, payload.query)
    context_text = "\n\n".join(
        f"File: {c['path']}\n{c['text']}" for c in context_chunks
    )

    system_prompt = f"""You are a helpful assistant that explains codebases.
Use ONLY the following code context to answer the question.
Format code blocks using triple backticks with the language name.

Context:
{context_text}"""

    messages = [{"role": "system", "content": system_prompt}]
    if payload.history:
        for msg in (payload.history or [])[-4:]:
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": payload.query})

    sources = list(set([c["path"] for c in context_chunks]))
    similar_files = get_similar_files(payload.repo_name, payload.query)

    async def event_generator():
        full_answer = ""
        try:
            stream = _client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages,
                temperature=0.2,
                max_tokens=1000,
                stream=True
            )

            for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    full_answer += delta
                    yield f"data: {json.dumps({'type': 'token', 'content': delta})}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'sources': sources, 'similar_files': similar_files})}\n\n"

            db.add(ChatMessage(
                user_id=current_user.id,
                repo_name=payload.repo_name,
                role="user",
                content=payload.query
            ))
            db.add(ChatMessage(
                user_id=current_user.id,
                repo_name=payload.repo_name,
                role="assistant",
                content=full_answer,
                sources=",".join(sources)
            ))
            db.commit()

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/history")
def get_history(
    repo_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    messages = db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id,
        ChatMessage.repo_name == repo_name
    ).order_by(ChatMessage.created_at).all()

    return [
        {
            "role": m.role,
            "content": m.content,
            "sources": m.sources.split(",") if m.sources else []
        }
        for m in messages
    ]