# Phase Log

## Phase 0 — Project Setup ✅
- Created backend (FastAPI) and frontend (Next.js + Tailwind) folder structure
- Set up Python virtual environment for backend
- Installed core dependencies: fastapi, uvicorn, sqlalchemy, chromadb, langchain, etc.
- Verified backend boots at http://127.0.0.1:8000
- Verified frontend boots at http://localhost:3000
- Status: Complete

## Phase 1 — GitHub API Connection + Repo Ingestion ✅
- Added GitHub token handling via core/config.py
- Built github_service.py to parse repo URL, recursively fetch file tree, decode contents
- Added filtering for binaries, node_modules, venv, oversized files
- Built POST /repos/connect endpoint in api/routes/repos.py
- Verified with octocat/Hello-World — returned correct repo_name, file_count, file contents
- Status: Complete

## Phase 2 — Chunking + Embeddings + ChromaDB Storage ✅
- Built chunking_service.py using LangChain's RecursiveCharacterTextSplitter (code-aware)
- Built embedding_service.py using sentence-transformers (all-MiniLM-L6-v2, local/free)
- Built vectorstore_service.py using ChromaDB persistent client
- Added POST /repos/ingest endpoint: fetch → chunk → embed → store
- Fixed HF cache permission issue by relocating HF_HOME outside OneDrive sync folder
- Verified with octocat/Spoon-Knife — 3 files, 3 chunks stored successfully
- Status: Complete

## Phase 3 — Retrieval + Chat (RAG) ✅
- Built rag_service.py: embeds query, retrieves top-k chunks from ChromaDB, builds context-grounded prompt
- Used Groq (llama-3.1-8b-instant) as the LLM for answer generation
- Built POST /chat/ask endpoint in api/routes/chat.py
- Wired chat router into main.py
- Verified with octocat/Spoon-Knife — correctly explained repo purpose using retrieved context
- Status: Complete

## Phase 4 — Frontend Core ✅
- Built lib/api.ts (axios client) and lib/store.ts (zustand state)
- Built repo-connect UI and chat interface in app/page.tsx
- Wired frontend to backend via NEXT_PUBLIC_API_URL
- Verified full flow: connect octocat/Spoon-Knife → ask question → received grounded answer with sources
- Status: Complete

### UI Redesign
- Replaced generic indigo/zinc theme with a terminal-inspired aesthetic
- Palette: warm charcoal background, amber accent, sage green for source citations
- Monospace (Geist Mono) for headers/labels, sans for answer text
- Added subtle message fade-in and blinking cursor animation
- Status: Complete

## Phase 5 — Authentication & History ✅
- Protected /repos/ingest and /chat/ask with JWT auth (get_current_user dependency)
- Added /repos/my-repos to list a user's connected repos
- Added /chat/history to retrieve past messages for a repo
- Chat messages (user + assistant) saved to PostgreSQL on every /chat/ask call
- Verified full flow: register → login → ingest (authed) → chat (authed) → history retrieval
- Status: Complete

## Phase 5 — Authentication & History ✅
- Protected /repos/ingest and /chat/ask with JWT auth (get_current_user dependency)
- Added /repos/my-repos and /chat/history endpoints
- Chat messages saved to PostgreSQL (Neon) on every /chat/ask call
- Built /auth login/register frontend page
- Rebuilt frontend layout: persistent sidebar (repo list, connect button, sign out) + main panel
- Added brand-gradient text, ambient background glow, pulse animation on connection status
- Fixed SSR hydration mismatch (token read moved to post-mount effect)
- Verified full cycle: register → connect repo → ask → sign out → sign in → repo + history persist
- Status: Complete

## Phase 7 — Code Graph / Architecture Generation (backend) ✅
- Built graph_service.py: regex-based import extraction (Python + JS/TS) and path resolution
- Added GET /repos/{repo_name}/graph endpoint
- Verified on real multi-file repo (vizzy-chat) — correctly resolved 23 import edges across components/store
- Status: Backend complete, frontend visualization pending

## Phase 8 — UX Polish ✅
- Added DELETE /repos/{repo_name} endpoint (removes repo + chat history)
- Added inline error messages (replaced alert() popups) for connect and ask failures
- Added spinner animations for connect and "thinking" states
- Added re-sync button to re-ingest a repo's latest code
- Added hover-to-reveal delete button per repo in sidebar
- Status: Complete

## Phase 7 — Code Graph / Architecture Generation ✅
- Built graph_service.py: regex import extraction for Python + JS/TS
- Added GET /repos/{repo_name}/graph endpoint
- Built ArchitectureGraph.tsx using react-force-graph-2d (force-directed, draggable, labeled nodes)
- Wired architecture button into chat header
- Fixed duplicate source chips with Array.from(new Set())
- Verified on vizzy-chat (23 edges) and electricity-theft-detection (real Python project graph)
- Status: Complete