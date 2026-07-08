from langchain_text_splitters import RecursiveCharacterTextSplitter

def chunk_file(content: str, path: str, chunk_size: int = 1000, chunk_overlap: int = 150):
    """
    Splits a single file's content into overlapping chunks.
    Returns a list of dicts: {chunk_text, chunk_index, path}
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\nclass ", "\ndef ", "\nfunction ", "\n\n", "\n", " ", ""]
    )

    splits = splitter.split_text(content)

    return [
        {
            "chunk_text": chunk,
            "chunk_index": idx,
            "path": path
        }
        for idx, chunk in enumerate(splits)
    ]


def chunk_repo_files(files: list):
    """
    Takes the files list from github_service and returns all chunks across all files.
    """
    all_chunks = []
    for file in files:
        chunks = chunk_file(file["content"], file["path"])
        all_chunks.extend(chunks)
    return all_chunks