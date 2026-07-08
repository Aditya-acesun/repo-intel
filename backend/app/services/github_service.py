from github import Github
from app.core.config import settings

# Folders/files we don't want to pull in (binaries, deps, build artifacts)
IGNORE_DIRS = {
    "node_modules", ".git", "venv", "__pycache__",
    "dist", "build", ".next", ".idea", ".vscode"
}

IGNORE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".eot", ".pdf", ".zip",
    ".lock", ".min.js", ".map"
}

MAX_FILE_SIZE = 200_000  # skip files larger than ~200KB to avoid huge payloads


def parse_repo_url(repo_url: str) -> str:
    """
    Converts https://github.com/owner/repo (with or without trailing slash/.git)
    into 'owner/repo' format required by PyGithub.
    """
    cleaned = repo_url.strip().rstrip("/")
    if cleaned.endswith(".git"):
        cleaned = cleaned[:-4]
    parts = cleaned.split("/")
    owner, repo = parts[-2], parts[-1]
    return f"{owner}/{repo}"


def should_skip(path: str) -> bool:
    parts = path.split("/")
    if any(part in IGNORE_DIRS for part in parts):
        return True
    if any(path.endswith(ext) for ext in IGNORE_EXTENSIONS):
        return True
    return False


def fetch_repo_files(repo_url: str):
    """
    Fetches the file tree and contents of a GitHub repo.
    Returns a list of dicts: {path, content, size}
    """
    g = Github(settings.GITHUB_TOKEN)
    repo_full_name = parse_repo_url(repo_url)
    repo = g.get_repo(repo_full_name)

    contents = repo.get_contents("")
    files_data = []
    stack = list(contents)

    while stack:
        file_item = stack.pop()

        if file_item.type == "dir":
            if file_item.name in IGNORE_DIRS:
                continue
            stack.extend(repo.get_contents(file_item.path))
            continue

        if should_skip(file_item.path):
            continue

        if file_item.size > MAX_FILE_SIZE:
            continue

        try:
            decoded_content = file_item.decoded_content.decode("utf-8", errors="ignore")
        except Exception:
            continue

        files_data.append({
            "path": file_item.path,
            "content": decoded_content,
            "size": file_item.size
        })
        

    return {
        "repo_name": repo.full_name,
        "description": repo.description,
        "default_branch": repo.default_branch,
        "file_count": len(files_data),
        "files": files_data
    }


def get_file_tree(repo_url: str) -> dict:
    """Returns a nested file tree structure for the repo."""
    g = Github(settings.GITHUB_TOKEN)
    repo_full_name = parse_repo_url(repo_url)
    repo = g.get_repo(repo_full_name)

    contents = repo.get_contents("")
    tree = []
    stack = list(contents)

    while stack:
        item = stack.pop()
        if item.type == "dir":
            if item.name in IGNORE_DIRS:
                continue
            stack.extend(repo.get_contents(item.path))
            tree.append({"path": item.path, "name": item.name, "type": "dir"})
        else:
            if should_skip(item.path):
                continue
            tree.append({"path": item.path, "name": item.name, "type": "file"})

    return {"repo_name": repo.full_name, "tree": sorted(tree, key=lambda x: (x["type"] == "file", x["path"]))}


def get_commits(repo_url: str, limit: int = 10) -> list:
    """Returns the last N commits for the repo."""
    g = Github(settings.GITHUB_TOKEN)
    repo_full_name = parse_repo_url(repo_url)
    repo = g.get_repo(repo_full_name)

    commits = []
    for commit in repo.get_commits()[:limit]:
        commits.append({
            "sha": commit.sha[:7],
            "message": commit.commit.message.split("\n")[0],
            "author": commit.commit.author.name,
            "date": commit.commit.author.date.strftime("%Y-%m-%d"),
            "url": commit.html_url
        })
    return commits