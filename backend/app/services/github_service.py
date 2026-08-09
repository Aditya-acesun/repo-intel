import base64

from concurrent.futures import ThreadPoolExecutor, as_completed
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

# Number of files fetched concurrently. Kept low (rather than something like
# 8+) because large repos with hundreds/thousands of files were tripping
# GitHub's secondary (abuse-detection) rate limit hard — resulting in
# 30+ minute backoffs. 3 concurrent workers is a much safer middle ground.
MAX_WORKERS = 3

# Cap total files ingested per repo. For huge OSS repos (e.g. google/guava,
# 2500+ files) there's no need to embed literally everything for a repo-QA
# tool to be useful — this keeps ingest time and rate-limit risk bounded.
MAX_FILES_PER_REPO = 300


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

    Uses the Git Trees API (a single recursive call) to get the full file
    listing, then fetches file contents (blobs) concurrently across a small
    thread pool since each blob fetch is I/O-bound. Concurrency is kept
    deliberately modest and total file count capped to avoid tripping
    GitHub's secondary rate limit on large repos.

    Returns a list of dicts: {path, content, size}
    """
    g = Github(settings.GITHUB_TOKEN)
    repo_full_name = parse_repo_url(repo_url)
    repo = g.get_repo(repo_full_name)

    tree = repo.get_git_tree(repo.default_branch, recursive=True)

    candidates = [
        item for item in tree.tree
        if item.type == "blob"
        and not should_skip(item.path)
        and (not item.size or item.size <= MAX_FILE_SIZE)
    ][:MAX_FILES_PER_REPO]

    def fetch_one(item):
        try:
            blob = repo.get_git_blob(item.sha)
            decoded_content = base64.b64decode(blob.content).decode("utf-8", errors="ignore")
            return {
                "path": item.path,
                "content": decoded_content,
                "size": item.size or 0
            }
        except Exception:
            return None

    files_data = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(fetch_one, item) for item in candidates]
        for future in as_completed(futures):
            result = future.result()
            if result is not None:
                files_data.append(result)

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