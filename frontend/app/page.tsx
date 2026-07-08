"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ingestRepo, getMyRepos, getHistory, deleteRepo,
  getRepoGraph, getFileTree, getCommits, streamQuestion
} from "@/lib/api";
import { useAppStore } from "@/lib/store";
import ArchitectureGraph from "@/components/ArchitectureGraph";
import FileExplorer from "@/components/FileExplorer";
import CommitHistory from "@/components/commithistory";
import MessageContent from "@/components/MessageContent";

const SUGGESTED_QUESTIONS = [
  "What does this repository do?",
  "What's the entry point of this app?",
  "How does authentication work?",
  "Explain the folder structure.",
  "What are the main dependencies?",
];

type SidePanel = "files" | "commits" | null;

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [myRepos, setMyRepos] = useState<{ repo_name: string; repo_url: string }[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [askError, setAskError] = useState("");
  const [resyncing, setResyncing] = useState(false);
  const [graphData, setGraphData] = useState<any>(null);
  const [showGraph, setShowGraph] = useState(false);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [commits, setCommits] = useState<any[]>([]);
  const [loadingPanel, setLoadingPanel] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [similarFiles, setSimilarFiles] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { token, setToken, repoName, setRepoName, messages, setMessages, addMessage } = useAppStore();

  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (stored) setToken(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.push("/auth"); return; }
    getMyRepos().then((repos) => {
      setMyRepos(repos);
      if (!repoName) setShowConnect(repos.length === 0);
    }).catch(() => {});
  }, [hydrated, token]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSelectRepo = async (name: string) => {
    setRepoName(name);
    setShowConnect(false);
    setAskError("");
    setShowGraph(false);
    setGraphData(null);
    setSidePanel(null);
    setSimilarFiles([]);
    try {
      const history = await getHistory(name);
      setMessages(history);
    } catch {
      setMessages([]);
    }
  };

  const handleConnect = async () => {
    if (!repoUrl) return;
    setIngesting(true);
    setConnectError("");
    try {
      const data = await ingestRepo(repoUrl);
      setRepoName(data.repo_name);
      setMessages([]);
      setShowConnect(false);
      setRepoUrl("");
      setMyRepos((prev) =>
        prev.some((r) => r.repo_name === data.repo_name) ? prev : [...prev, { repo_name: data.repo_name, repo_url: repoUrl }]
      );
    } catch (err: any) {
      setConnectError(err?.response?.data?.detail || "Couldn't read that repository.");
    } finally {
      setIngesting(false);
    }
  };

  const handleResync = async () => {
    if (!repoName) return;
    const repo = myRepos.find((r) => r.repo_name === repoName);
    if (!repo) return;
    setResyncing(true);
    try { await ingestRepo(repo.repo_url); }
    catch { setAskError("Re-sync failed. Try again."); }
    finally { setResyncing(false); }
  };

  const handleDeleteRepo = async (name: string) => {
    if (!confirm(`Remove ${name} and its chat history?`)) return;
    try {
      await deleteRepo(name);
      setMyRepos((prev) => prev.filter((r) => r.repo_name !== name));
      if (repoName === name) { setRepoName(null); setMessages([]); setShowConnect(true); }
    } catch { alert("Couldn't remove repository."); }
  };

  const handleAsk = (q?: string) => {
    const question = q || query;
    if (!question || !repoName || loading) return;
    setQuery("");
    setAskError("");
    setSimilarFiles([]);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    addMessage({ role: "user", content: question });
    setLoading(true);
    setStreamingContent("");

    let accumulated = "";
    streamQuestion(
      repoName, question, history,
      (token) => {
        accumulated += token;
        setStreamingContent(accumulated);
      },
      (sources, similar) => {
        addMessage({ role: "assistant", content: accumulated, sources });
        setSimilarFiles(similar);
        setStreamingContent("");
        setLoading(false);
      },
      (err) => {
        addMessage({ role: "assistant", content: "Something went wrong — try again." });
        setAskError(err);
        setStreamingContent("");
        setLoading(false);
      }
    );
  };

  const handleFileClick = (path: string) => {
    setQuery(`Explain the file: ${path}`);
  };

  const handleViewArchitecture = async () => {
    if (!repoName) return;
    setLoadingGraph(true);
    setShowGraph(true);
    try {
      const data = await getRepoGraph(repoName);
      setGraphData(data);
    } catch {
      setAskError("Couldn't generate architecture graph.");
      setShowGraph(false);
    } finally {
      setLoadingGraph(false);
    }
  };

  const handleTogglePanel = async (panel: SidePanel) => {
    if (sidePanel === panel) { setSidePanel(null); return; }
    setSidePanel(panel);
    setLoadingPanel(true);
    try {
      if (panel === "files" && repoName) {
        const data = await getFileTree(repoName);
        setFileTree(data.tree);
      } else if (panel === "commits" && repoName) {
        const data = await getCommits(repoName);
        setCommits(data);
      }
    } catch { setSidePanel(null); }
    finally { setLoadingPanel(false); }
  };

  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleLogout = () => {
    setToken(null);
    setRepoName(null);
    router.push("/auth");
  };

  if (!hydrated || !token) return null;

  return (
    <div className="min-h-screen bg-transparent text-[#EDEAE3] flex">
      {/* Main sidebar */}
      <aside className="w-56 h-screen sticky top-0 border-r border-[#2A2C30] flex flex-col py-6 px-3 shrink-0">
        <div className="flex items-baseline gap-2 px-2 mb-8">
          <span className="brand-gradient font-mono text-base font-semibold">repo-intel</span>
        </div>

        <button
          onClick={() => { setShowConnect(true); setRepoName(null); setConnectError(""); }}
          className="flex items-center gap-2 text-sm font-mono text-[#0E0F11] bg-[#E8A33D] hover:bg-[#F0B559] rounded-md px-3 py-2 mb-6 font-medium transition-colors"
        >
          + connect repo
        </button>

        <div className="text-[#52555C] font-mono text-[11px] uppercase tracking-wider px-2 mb-2">repositories</div>
        <div className="flex flex-col gap-0.5 overflow-y-auto flex-1">
          {myRepos.length === 0 && (
            <p className="text-[#43464C] font-mono text-xs px-2 py-3">none yet</p>
          )}
          {myRepos.map((r) => (
            <div key={r.repo_name} className="group flex items-center">
              <button
                onClick={() => handleSelectRepo(r.repo_name)}
                className={`sidebar-item flex-1 text-left font-mono text-sm text-[#9EA1A8] hover:text-[#EDEAE3] px-3 py-2 rounded-r-md truncate ${repoName === r.repo_name ? "active text-[#EDEAE3]" : ""}`}
                title={r.repo_name}
              >
                {r.repo_name}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteRepo(r.repo_name); }}
                className="opacity-0 group-hover:opacity-100 text-[#52555C] hover:text-[#C97064] font-mono text-xs px-2 transition-opacity"
              >✕</button>
            </div>
          ))}
        </div>

        <button onClick={handleLogout} className="text-xs font-mono text-[#52555C] hover:text-[#EDEAE3] transition-colors px-2 pt-4 mt-auto border-t border-[#2A2C30] text-left">
          sign out
        </button>
      </aside>

      {/* Secondary panel (files/commits) */}
      {sidePanel && repoName && (
        <div className="w-60 h-screen sticky top-0 border-r border-[#2A2C30] flex flex-col py-4 px-3 shrink-0 bg-[#0B0C0E]">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-xs text-[#9EA1A8] uppercase tracking-wider">
              {sidePanel === "files" ? "files" : "commits"}
            </span>
            <button onClick={() => setSidePanel(null)} className="text-[#52555C] hover:text-[#EDEAE3] font-mono text-xs">✕</button>
          </div>
          {loadingPanel ? (
            <div className="flex items-center gap-2 font-mono text-xs text-[#52555C] mt-4">
              <span className="w-3 h-3 border-2 border-[#52555C] border-t-transparent rounded-full animate-spin" />
              loading…
            </div>
          ) : sidePanel === "files" ? (
            <FileExplorer tree={fileTree} onFileClick={(path) => { handleFileClick(path); setSidePanel(null); }} />
          ) : (
            <CommitHistory
              commits={commits}
              onAskAboutCommits={() => { handleAsk("What changed recently based on the commit history?"); setSidePanel(null); }}
            />
          )}
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 py-10">
        {showConnect || !repoName ? (
          <div className="w-full max-w-xl">
            <h1 className="font-mono text-2xl font-semibold text-[#EDEAE3] mb-2">connect a repository</h1>
            <p className="text-[#7A9B7E] font-mono text-sm mb-6"># point it at any public GitHub repo</p>

            <div className="rounded-lg border border-[#2A2C30] bg-[#131416] p-5 font-mono text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[#E8A33D]">$</span>
                <span className="text-[#9EA1A8]">connect</span>
                <input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  placeholder="https://github.com/owner/repo"
                  autoFocus
                  className="flex-1 bg-transparent outline-none text-[#EDEAE3] placeholder:text-[#43464C] caret-[#E8A33D]"
                />
              </div>
            </div>

            {connectError && <p className="text-xs text-[#C97064] mt-3 font-mono"># {connectError}</p>}

            <button
              onClick={handleConnect}
              disabled={ingesting || !repoUrl}
              className="mt-4 rounded-lg bg-[#E8A33D] text-[#0E0F11] font-mono text-sm py-3 px-6 font-medium
                         transition-colors hover:bg-[#F0B559] disabled:bg-[#2A2C30] disabled:text-[#52555C]
                         disabled:cursor-not-allowed flex items-center gap-2"
            >
              {ingesting && <span className="w-3 h-3 border-2 border-[#0E0F11] border-t-transparent rounded-full animate-spin" />}
              {ingesting ? "reading repository…" : "Connect"}
            </button>
          </div>
        ) : (
          <div className="w-full max-w-3xl h-full flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between font-mono text-xs pb-3 border-b border-[#2A2C30]">
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7A9B7E] pulse-dot" />
                <span className="text-[#EDEAE3] text-sm">{repoName}</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => handleTogglePanel("files")} className={`transition-colors ${sidePanel === "files" ? "text-[#E8A33D]" : "text-[#52555C] hover:text-[#9EA1A8]"}`}>
                  files
                </button>
                <button onClick={() => handleTogglePanel("commits")} className={`transition-colors ${sidePanel === "commits" ? "text-[#E8A33D]" : "text-[#52555C] hover:text-[#9EA1A8]"}`}>
                  commits
                </button>
                <button onClick={handleViewArchitecture} className="text-[#52555C] hover:text-[#7A9B7E] transition-colors">
                  architecture
                </button>
                <button onClick={handleResync} disabled={resyncing} className="text-[#52555C] hover:text-[#E8A33D] transition-colors disabled:opacity-50">
                  {resyncing ? "re-syncing…" : "re-sync"}
                </button>
              </div>
            </div>

            {/* Architecture graph */}
            {showGraph && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-[#52555C]">
                    {loadingGraph ? "mapping dependencies…" : graphData ? `${graphData.nodes.length} files · ${graphData.edges.length} dependencies` : ""}
                  </span>
                  <button onClick={() => setShowGraph(false)} className="text-xs font-mono text-[#52555C] hover:text-[#EDEAE3]">close</button>
                </div>
                {graphData && <ArchitectureGraph data={graphData} />}
              </div>
            )}

            {/* Messages */}
            <div ref={scrollRef} className="flex flex-col gap-4 flex-1 overflow-y-auto scroll-smooth pr-2">
              {messages.length === 0 && !streamingContent && (
                <div className="py-8">
                  <p className="text-[#52555C] font-mono text-sm text-center mb-6">ask something about this repo</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleAsk(q)}
                        className="text-xs font-mono text-[#9EA1A8] border border-[#2A2C30] bg-[#131416] hover:border-[#E8A33D] hover:text-[#E8A33D] rounded-md px-3 py-1.5 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="self-end max-w-[80%] msg-enter">
                    <div className="rounded-lg bg-[#1C1E21] border border-[#2A2C30] px-4 py-2.5">
                      <p className="text-sm text-[#EDEAE3]">{m.content}</p>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="max-w-[88%] msg-enter group/msg">
                    <div className="rounded-lg bg-[#131416] border border-[#1F2023] px-5 py-4 relative">
                      <button
                        onClick={() => handleCopy(m.content, i)}
                        className="absolute top-3 right-3 opacity-0 group-hover/msg:opacity-100 text-[#52555C] hover:text-[#EDEAE3] transition-all font-mono text-[10px]"
                      >
                        {copiedIndex === i ? "copied!" : "copy"}
                      </button>
                      <div className="pr-10">
                        <MessageContent content={m.content} />
                      </div>
                      {m.sources && m.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[#2A2C30]">
                          {Array.from(new Set(m.sources)).map((s, j) => (
                            <span key={j} className="font-mono text-[11px] text-[#7A9B7E] bg-[#16201A] border border-[#243023] rounded px-1.5 py-0.5">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}

              {/* Streaming */}
              {streamingContent && (
                <div className="max-w-[88%] msg-enter">
                  <div className="rounded-lg bg-[#131416] border border-[#1F2023] px-5 py-4">
                    <MessageContent content={streamingContent} />
                    <span className="cursor-blink text-[#E8A33D] font-mono">▮</span>
                  </div>
                </div>
              )}

              {loading && !streamingContent && (
                <div className="flex items-center gap-2 font-mono text-xs text-[#52555C]">
                  <span className="w-3 h-3 border-2 border-[#52555C] border-t-transparent rounded-full animate-spin" />
                  thinking…
                </div>
              )}

              {/* Similar files */}
              {similarFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="font-mono text-[10px] text-[#52555C]">related files:</span>
                  {similarFiles.map((f) => (
                    <button
                      key={f}
                      onClick={() => handleAsk(`Explain the file: ${f}`)}
                      className="font-mono text-[10px] text-[#7A9B7E] bg-[#16201A] border border-[#243023] hover:border-[#7A9B7E] rounded px-1.5 py-0.5 transition-colors"
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {askError && <p className="text-xs text-[#C97064] font-mono px-1">⚠ {askError}</p>}

            {/* Input */}
            <div className="flex items-center gap-2 rounded-lg border border-[#2A2C30] bg-[#131416] px-4 py-1 focus-within:border-[#E8A33D] transition-colors">
              <span className="text-[#E8A33D] font-mono text-sm">$</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                placeholder="ask something about this repo…"
                className="flex-1 bg-transparent outline-none py-3 text-sm text-[#EDEAE3] placeholder:text-[#43464C]"
              />
              <button
                onClick={() => handleAsk()}
                disabled={loading || !query}
                className="font-mono text-xs text-[#0E0F11] bg-[#E8A33D] rounded px-3 py-1.5 font-medium hover:bg-[#F0B559] disabled:bg-[#2A2C30] disabled:text-[#52555C] disabled:cursor-not-allowed transition-colors"
              >
                ask
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}