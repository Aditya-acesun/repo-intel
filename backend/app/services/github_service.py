import base64
import time

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

# Small delay between per-file blob fetches to avoid GitHub's secondary
# (abuse-detection) rate limit, which can trigger even with plenty of
# core quota remaining if requests fire too fast in a burst.
BLOB_FETCH_DELAY = 0.05


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
    Fetches the file tree and contents of a GitHub repo using the Git Trees API
    (a single recursive call) instead of walking directories one-by-one with
    get_contents, which fires far too many requests for larger repos and trips
    GitHub's secondary rate limit.

    Returns a list of dicts: {path, content, size}
    """
    g = Github(settings.GITHUB_TOKEN)
    repo_full_name = parse_repo_url(repo_url)
    repo = g.get_repo(repo_full_name)

    tree = repo.get_git_tree(repo.default_branch, recursive=True)
    files_data = []

    for item in tree.tree:
        if item.type != "blob":
            continue

        if should_skip(item.path):
            continue

        if item.size and item.size > MAX_FILE_SIZE:
            continue

        try:
            blob = repo.get_git_blob(item.sha)
            decoded_content = base64.b64decode(blob.content).decode("utf-8", errors="ignore")
        except Exception:
            continue

        files_data.append({
            "path": item.path,
            "content": decoded_content,
            "size": item.size or 0
        })

        time.sleep(BLOB_FETCH_DELAY)

    return {
        "repo_name": repo.full_name,
        "description": repo.description,
        "default_branch": repo.default_branch,
        "file_count": len(files_data),
        "files": files_data
    }


def get_file_tree(repo_url: str) -> dict:
    """Returns a nested file tree structure for the repo, via a single Git Trees API call."""
    g = Github(settings.GITHUB_TOKEN)
    repo_full_name = parse_repo_url(repo_url)
    repo = g.get_repo(repo_full_name)

    git_tree = repo.get_git_tree(repo.default_branch, recursive=True)
    tree = []

    for item in git_tree.tree:
        path_parts = item.path.split("/")
        name = path_parts[-1]

        if item.type == "tree":
            if name in IGNORE_DIRS:
                continue
            tree.append({"path": item.path, "name": name, "type": "dir"})
        else:
            if should_skip(item.path):
                continue
            tree.append({"path": item.path, "name": name, "type": "file"})

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