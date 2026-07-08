"use client";

import CodeBlock from "./codeblock";

interface Props {
  content: string;
}

export default function MessageContent({ content }: Props) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lines = part.slice(3, -3).split("\n");
          const language = lines[0].trim() || "text";
          const code = lines.slice(1).join("\n");
          return <CodeBlock key={i} code={code} language={language} />;
        }
        return (
          <p key={i} className="text-[15px] leading-relaxed text-[#D9D6CE] whitespace-pre-wrap">
            {part}
          </p>
        );
      })}
    </div>
  );
}