"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export default function CodeBlock({ code, language = "text" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-2 rounded-lg overflow-hidden border border-[#2A2C30]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1C1E21] border-b border-[#2A2C30]">
        <span className="font-mono text-[10px] text-[#52555C]">{language}</span>
        <button
          onClick={handleCopy}
          className="font-mono text-[10px] text-[#52555C] hover:text-[#EDEAE3] transition-colors"
        >
          {copied ? "copied!" : "copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          background: "#0E0F11",
          fontSize: "12px",
          padding: "12px 16px",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}