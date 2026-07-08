from groq import Groq
from app.core.config import settings
from app.services.vectorstore_service import get_or_create_collection
from app.services.embedding_service import embed_texts

_client = Groq(api_key=settings.GROQ_API_KEY)


def retrieve_context(repo_name: str, query: str, top_k: int = 8):
    collection = get_or_create_collection(repo_name)
    query_embedding = embed_texts([query])[0]

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k
    )

    chunks = results["documents"][0]
    metadatas = results["metadatas"][0]

    return [
        {"text": chunk, "path": meta["path"]}
        for chunk, meta in zip(chunks, metadatas)
    ]


def get_similar_files(repo_name: str, query: str, top_k: int = 3) -> list[str]:
    context_chunks = retrieve_context(repo_name, query, top_k=top_k * 2)
    seen = []
    for c in context_chunks:
        if c["path"] not in seen:
            seen.append(c["path"])
        if len(seen) >= top_k:
            break
    return seen


def generate_answer(repo_name: str, query: str, history: list[dict] = None):
    context_chunks = retrieve_context(repo_name, query, top_k=8)

    context_text = "\n\n".join(
        f"### File: {c['path']}\n{c['text']}" for c in context_chunks
    )

    system_prompt = f"""You are an expert code analyst. Your job is to explain codebases accurately and in detail.

RULES:
- Answer ONLY using the code context provided below
- Be specific — reference actual function names, class names, variable names, and file paths from the code
- If the code shows implementation details, explain them precisely
- Format code examples using triple backticks with the language name
- If the answer is not in the context, say "I don't have enough context to answer that — try re-syncing the repo or asking about a specific file"
- Never make up details that aren't in the code

CODE CONTEXT:
{context_text}"""

    messages = [{"role": "system", "content": system_prompt}]

    # Only include last 2 exchanges (4 messages) to preserve token budget for code context
    if history:
        recent = history[-4:]
        for msg in recent:
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": query})

    response = _client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=messages,
        temperature=0.1,
        max_tokens=1500
    )

    similar_files = get_similar_files(repo_name, query)

    return {
        "answer": response.choices[0].message.content,
        "sources": list(set([c["path"] for c in context_chunks])),
        "similar_files": similar_files
    }