from huggingface_hub import InferenceClient
from app.core.config import settings

_client = InferenceClient(token=settings.HF_TOKEN)

MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def embed_texts(texts: list[str]) -> list[list[float]]:
    embeddings = _client.feature_extraction(texts, model=MODEL)
    return embeddings.tolist()