import traceback
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.services.github_service import fetch_repo_files, get_file_tree, get_commits
from app.services.chunking_service import chunk_repo_files
from app.services.vectorstore_service import store_chunks
from app.services.graph_service import build_dependency_graph
from app.api.routes.auth import get_current_user
from app.db.session import get_db, SessionLocal
from app.models.user import User
from app.models.repository import Repository
from app.models.chat_message import ChatMessage

router = APIRouter(prefix="/repos", tags=["Repositories"])


class RepoConnectRequest(BaseModel):
    repo_url: str


@router.post("/connect")
def connect_repo(payload: RepoConnectRequest, current_user: User = Depends(get_current_user)):
    try:
        result = fetch_repo_files(payload.repo_url)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ingest")
def ingest_repo(
    payload: RepoConnectRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        # Slow pipeline first — GitHub fetch, chunking, embeddings, Qdrant upsert.
        # Deliberately NOT holding a DB session open during any of this, since
        # Neon's free-tier compute can suspend/idle mid-request and kill a
        # connection that's just sitting there unused.
        repo_data = fetch_repo_files(payload.repo_url)
        chunks = chunk_repo_files(repo_data["files"])
        stored_count = store_chunks(repo_data["repo_name"], chunks)

        # Only now, right before we actually need it, open a fresh DB session.
        db = SessionLocal()
        try:
            existing = db.query(Repository).filter(
                Repository.user_id == current_user.id,
                Repository.repo_name == repo_data["repo_name"]
            ).first()

            if not existing:
                repo_record = Repository(
                    user_id=current_user.id,
                    repo_name=repo_data["repo_name"],
                    repo_url=payload.repo_url
                )
                db.add(repo_record)
                db.commit()
        finally:
            db.close()

        return {
            "repo_name": repo_data["repo_name"],
            "file_count": repo_data["file_count"],
            "chunk_count": stored_count,
            "status": "Ingestion complete"
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/my-repos")
def list_my_repos(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repos = db.query(Repository).filter(Repository.user_id == current_user.id).all()
    return [{"repo_name": r.repo_name, "repo_url": r.repo_url} for r in repos]


@router.delete("/{repo_name:path}")
def delete_repo(
    repo_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = db.query(Repository).filter(
        Repository.user_id == current_user.id,
        Repository.repo_name == repo_name
    ).first()

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    db.delete(repo)
    db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id,
        ChatMessage.repo_name == repo_name
    ).delete()
    db.commit()

    return {"status": "deleted", "repo_name": repo_name}


@router.get("/{repo_name:path}/graph")
def get_repo_graph(
    repo_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = db.query(Repository).filter(
        Repository.user_id == current_user.id,
        Repository.repo_name == repo_name
    ).first()

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    try:
        repo_data = fetch_repo_files(repo.repo_url)
        graph = build_dependency_graph(repo_data["files"])
        return graph
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{repo_name:path}/file-tree")
def get_repo_file_tree(
    repo_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = db.query(Repository).filter(
        Repository.user_id == current_user.id,
        Repository.repo_name == repo_name
    ).first()

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    try:
        return get_file_tree(repo.repo_url)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{repo_name:path}/commits")
def get_repo_commits(
    repo_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = db.query(Repository).filter(
        Repository.user_id == current_user.id,
        Repository.repo_name == repo_name
    ).first()

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    try:
        return get_commits(repo.repo_url)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))