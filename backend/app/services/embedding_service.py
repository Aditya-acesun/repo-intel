import os
os.environ["HF_HOME"] = "C:\\hf_cache"

from sentence_transformers import SentenceTransformer

_model = SentenceTransformer("all-MiniLM-L6-v2")

def embed_texts(texts: list[str]):
    embeddings = _model.encode(texts, show_progress_bar=False)
    return embeddings.tolist()



from sentence_transformers import SentenceTransformer

# Loaded once, reused across requests
_model = SentenceTransformer("all-MiniLM-L6-v2")

def embed_texts(texts: list[str]):
    """
    Converts a list of text chunks into embedding vectors.
    """
    embeddings = _model.encode(texts, show_progress_bar=False)
    return embeddings.tolist()