import hashlib
import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
)
from app.core.config import settings

_client = QdrantClient(
    url=settings.QDRANT_URL,
    api_key=settings.QDRANT_API_KEY,
)


def _sanitize(repo_name: str) -> str:
    return repo_name.replace("/", "_")


def _deterministic_id(raw_id: str) -> str:
    """Qdrant point IDs must be unsigned ints or UUIDs — hash the chroma-style
    string id (e.g. 'path::chunk_index') into a stable UUID."""
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, raw_id))


class QdrantCollection:
    """Drop-in replacement for a chromadb Collection, exposing the same
    .add() and .query() signatures used elsewhere in the codebase."""

    def __init__(self, name: str):
        self.name = name

    def _ensure_exists(self, vector_size: int):
        if not _client.collection_exists(self.name):
            _client.create_collection(
                collection_name=self.name,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
            )

    def add(self, ids: list, embeddings: list, documents: list, metadatas: list):
        if not embeddings:
            return
        self._ensure_exists(vector_size=len(embeddings[0]))

        points = []
        for raw_id, embedding, document, metadata in zip(ids, embeddings, documents, metadatas):
            payload = dict(metadata)
            payload["document"] = document
            payload["original_id"] = raw_id
            points.append(
                PointStruct(
                    id=_deterministic_id(raw_id),
                    vector=embedding,
                    payload=payload,
                )
            )

        _client.upsert(collection_name=self.name, points=points)

    def query(self, query_embeddings: list, n_results: int = 8):
        if not _client.collection_exists(self.name):
            return {"documents": [[]], "metadatas": [[]]}

        results = _client.query_points(
            collection_name=self.name,
            query=query_embeddings[0],
            limit=n_results,
        ).points

        documents = [r.payload.get("document", "") for r in results]
        metadatas = [
            {k: v for k, v in r.payload.items() if k != "document"} for r in results
        ]

        # Match chromadb's nested-list response shape (one list per query embedding)
        return {"documents": [documents], "metadatas": [metadatas]}


def get_or_create_collection(repo_name: str):
    safe_name = _sanitize(repo_name)
    return QdrantCollection(safe_name)


def store_chunks(repo_name: str, chunks: list, batch_size: int = 25):
    from app.services.embedding_service import embed_texts

    collection = get_or_create_collection(repo_name)
    total_stored = 0

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]

        texts = [c["chunk_text"] for c in batch]
        ids = [f"{c['path']}::{c['chunk_index']}" for c in batch]
        metadatas = [{"path": c["path"], "chunk_index": c["chunk_index"]} for c in batch]

        embeddings = embed_texts(texts)

        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
        )

        total_stored += len(batch)
        # free the batch's memory before moving to the next one
        del texts, ids, metadatas, embeddings, batch

    return total_stored