"use client";

interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

interface Props {
  commits: Commit[];
  onAskAboutCommits: () => void;
}

export default function CommitHistory({ commits, onAskAboutCommits }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#52555C] font-mono text-[10px] uppercase tracking-wider">recent commits</span>
        <button
          onClick={onAskAboutCommits}
          className="text-[#52555C] hover:text-[#E8A33D] font-mono text-[10px] transition-colors"
        >
          ask about changes →
        </button>
      </div>
      {commits.map((c) => (
        <div key={c.sha} className="flex items-start gap-2 py-1.5 border-b border-[#1F2023] last:border-0">
          <span className="font-mono text-[10px] text-[#E8A33D] shrink-0 mt-0.5">{c.sha}</span>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs text-[#9EA1A8] truncate">{c.message}</p>
            <p className="font-mono text-[10px] text-[#52555C]">{c.author} · {c.date}</p>
          </div>
        </div>
      ))}
    </div>
  );
}