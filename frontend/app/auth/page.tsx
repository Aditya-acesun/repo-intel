"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "@/lib/api";
import { useAppStore } from "@/lib/store";

const FEATURES = [
  { icon: "⬡", title: "RAG-powered chat", desc: "Ask questions about any codebase in plain English" },
  { icon: "◈", title: "Architecture graphs", desc: "Visualize file dependencies and import relationships" },
  { icon: "◎", title: "Chat history", desc: "Every conversation saved and restored across sessions" },
  { icon: "⬟", title: "Multi-repo support", desc: "Connect and switch between multiple repositories" },
];

const TYPING_LINES = [
  "How does authentication work?",
  "What's the entry point of this app?",
  "Explain the data pipeline.",
  "Which files handle payments?",
  "How are API routes structured?",
];

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [typedText, setTypedText] = useState("");
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const router = useRouter();
  const setToken = useAppStore((s) => s.setToken);

  useEffect(() => {
    const current = TYPING_LINES[lineIndex];
    let timeout: NodeJS.Timeout;

    if (!deleting && charIndex < current.length) {
      timeout = setTimeout(() => {
        setTypedText(current.slice(0, charIndex + 1));
        setCharIndex((c) => c + 1);
      }, 45);
    } else if (!deleting && charIndex === current.length) {
      timeout = setTimeout(() => setDeleting(true), 1800);
    } else if (deleting && charIndex > 0) {
      timeout = setTimeout(() => {
        setTypedText(current.slice(0, charIndex - 1));
        setCharIndex((c) => c - 1);
      }, 22);
    } else if (deleting && charIndex === 0) {
      setDeleting(false);
      setLineIndex((l) => (l + 1) % TYPING_LINES.length);
    }

    return () => clearTimeout(timeout);
  }, [charIndex, deleting, lineIndex]);

  const handleSubmit = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      const data = mode === "login" ? await login(email, password) : await register(email, password);
      setToken(data.access_token);
      router.push("/");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-[#EDEAE3] flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 border-r border-[#2A2C30]">
        <div>
          <span className="brand-gradient font-mono text-lg font-semibold">repo-intel</span>
        </div>

        <div>
          <p className="text-[#52555C] font-mono text-xs mb-3 uppercase tracking-wider"># ask your codebase</p>
          <div className="font-mono text-2xl text-[#EDEAE3] min-h-[2.5rem]">
            <span>{typedText}</span>
            <span className="cursor-blink text-[#E8A33D]">▮</span>
          </div>

          <div className="mt-16 flex flex-col gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-4 msg-enter">
                <span className="text-[#E8A33D] font-mono text-lg mt-0.5">{f.icon}</span>
                <div>
                  <p className="text-sm font-mono text-[#EDEAE3] mb-0.5">{f.title}</p>
                  <p className="text-xs font-mono text-[#52555C]">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs font-mono text-[#3A3D42]">
          built with FastAPI · Next.js · ChromaDB · Groq
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-sm">
          <div className="flex items-baseline gap-3 mb-8 lg:hidden">
            <span className="brand-gradient font-mono text-lg font-semibold">repo-intel</span>
            <span className="text-[#52555C] font-mono text-sm">/ {mode}</span>
          </div>

          <h2 className="font-mono text-xl font-semibold text-[#EDEAE3] mb-1">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <p className="text-[#52555C] font-mono text-xs mb-8">
            {mode === "login" ? "sign in to access your repositories" : "get started for free"}
          </p>

          <div className="rounded-lg border border-[#2A2C30] bg-[#131416] p-6 font-mono text-sm mb-4">
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[#52555C] text-xs mb-1.5 block">email</label>
                <div className="flex items-center gap-2 border-b border-[#2A2C30] focus-within:border-[#E8A33D] transition-colors pb-1">
                  <span className="text-[#E8A33D]">→</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="you@example.com"
                    autoFocus
                    className="flex-1 bg-transparent outline-none text-[#EDEAE3] placeholder:text-[#43464C]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#52555C] text-xs mb-1.5 block">password</label>
                <div className="flex items-center gap-2 border-b border-[#2A2C30] focus-within:border-[#E8A33D] transition-colors pb-1">
                  <span className="text-[#E8A33D]">→</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="••••••••"
                    className="flex-1 bg-transparent outline-none text-[#EDEAE3] placeholder:text-[#43464C]"
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-xs text-[#C97064] mt-4 font-mono"># error: {error}</p>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            className="w-full rounded-lg bg-[#E8A33D] text-[#0E0F11] font-mono text-sm py-3 font-medium
                       transition-colors hover:bg-[#F0B559] hover:shadow-[0_0_20px_rgba(232,163,61,0.25)]
                       disabled:bg-[#2A2C30] disabled:text-[#52555C] disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {loading && <span className="w-3 h-3 border-2 border-[#0E0F11] border-t-transparent rounded-full animate-spin" />}
            {loading ? "authenticating…" : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="mt-4 w-full text-center text-xs font-mono text-[#52555C] hover:text-[#9EA1A8] transition-colors"
          >
            {mode === "login" ? "need an account? register →" : "already have one? sign in →"}
          </button>
        </div>
      </div>
    </div>
  );
}