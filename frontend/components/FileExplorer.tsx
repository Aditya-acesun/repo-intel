"use client";

import { useState } from "react";

interface TreeItem {
  path: string;
  name: string;
  type: "file" | "dir";
}

interface Props {
  tree: TreeItem[];
  onFileClick: (path: string) => void;
}

function getIcon(name: string) {
  if (name.endsWith(".py")) return "🐍";
  if (name.match(/\.(jsx|tsx)$/)) return "⚛";
  if (name.match(/\.(js|ts)$/)) return "📜";
  if (name.match(/\.(css|scss)$/)) return "🎨";
  if (name.match(/\.(md|txt)$/)) return "📄";
  if (name.match(/\.(json|yaml|yml|toml)$/)) return "⚙";
  return "📄";
}

export default function FileExplorer({ tree, onFileClick }: Props) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const filtered = search
    ? tree.filter((item) => item.path.toLowerCase().includes(search.toLowerCase()))
    : tree;

  const dirs = [...new Set(filtered.filter((i) => i.type === "dir").map((i) => i.path))];
  const files = filtered.filter((i) => i.type === "file");

  const toggleDir = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const getDepth = (path: string) => path.split("/").length - 1;

  return (
    <div className="flex flex-col h-full">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="search files…"
        className="w-full bg-[#131416] border border-[#2A2C30] rounded px-2 py-1.5 text-xs font-mono text-[#EDEAE3] placeholder:text-[#43464C] outline-none focus:border-[#E8A33D] mb-2"
      />
      <div className="flex-1 overflow-y-auto">
        {filtered.map((item) => (
          <div
            key={item.path}
            style={{ paddingLeft: `${getDepth(item.path) * 10 + 4}px` }}
          >
            {item.type === "dir" ? (
              <button
                onClick={() => toggleDir(item.path)}
                className="w-full text-left flex items-center gap-1.5 py-0.5 text-[#52555C] hover:text-[#9EA1A8] font-mono text-xs transition-colors"
              >
                <span>{collapsed.has(item.path) ? "▶" : "▼"}</span>
                <span>{item.name}/</span>
              </button>
            ) : (
              <button
                onClick={() => onFileClick(item.path)}
                className="w-full text-left flex items-center gap-1.5 py-0.5 text-[#9EA1A8] hover:text-[#E8A33D] font-mono text-xs transition-colors truncate group"
                title={item.path}
              >
                <span>{getIcon(item.name)}</span>
                <span className="truncate">{item.name}</span>
                <span className="ml-auto opacity-0 group-hover:opacity-100 text-[#52555C] text-[10px] shrink-0">ask →</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}