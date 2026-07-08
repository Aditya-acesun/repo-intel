import re
from pathlib import PurePosixPath


def extract_imports(content: str, path: str) -> list[str]:
    """
    Extracts likely imported module/file names from a file's content.
    Covers Python and JS/TS import styles. Best-effort, not a full parser.
    """
    imports = []

    if path.endswith(".py"):
        imports += re.findall(r'^\s*from\s+([\w\.]+)\s+import', content, re.MULTILINE)
        imports += re.findall(r'^\s*import\s+([\w\.]+)', content, re.MULTILINE)
    elif path.endswith((".js", ".jsx", ".ts", ".tsx")):
        imports += re.findall(r'import\s+.*?from\s+[\'"](.+?)[\'"]', content)
        imports += re.findall(r'require\([\'"](.+?)[\'"]\)', content)

    return imports


def resolve_import_to_path(imp: str, all_paths: list[str]) -> str | None:
    """
    Tries to match an import string to an actual file path in the repo.
    """
    imp_clean = imp.lstrip("./")
    candidates = [imp_clean, imp_clean.replace(".", "/")]

    for candidate in candidates:
        for p in all_paths:
            stem = PurePosixPath(p).with_suffix("")
            if str(stem).endswith(candidate) or str(stem) == candidate:
                return p
    return None


def build_dependency_graph(files: list[dict]) -> dict:
    """
    Builds a simple file-to-file dependency graph from import statements.
    Returns {nodes: [...], edges: [{source, target}]}
    """
    all_paths = [f["path"] for f in files]
    nodes = [{"id": p, "label": p.split("/")[-1]} for p in all_paths]
    edges = []
    seen_edges = set()

    for f in files:
        imports = extract_imports(f["content"], f["path"])
        for imp in imports:
            target = resolve_import_to_path(imp, all_paths)
            if target and target != f["path"]:
                edge_key = (f["path"], target)
                if edge_key not in seen_edges:
                    seen_edges.add(edge_key)
                    edges.append({"source": f["path"], "target": target})

    return {"nodes": nodes, "edges": edges}