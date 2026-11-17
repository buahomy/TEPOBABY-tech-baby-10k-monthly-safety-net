import { Fragment, ReactNode } from "react";

// Renders the small markdown subset used in shared/sierra/problems.js: blank-line paragraphs,
// "- " bullet lists, ``` code fences, `inline code` and **bold**. No HTML is injected.

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 3) return <strong key={i}>{part.slice(2, -2)}</strong>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  text.split("```").forEach((chunk, i) => {
    if (i % 2 === 1) {
      blocks.push(<pre key={`c${i}`}>{chunk.replace(/^\n/, "").replace(/\n$/, "")}</pre>);
      return;
    }
    chunk
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean)
      .forEach((b, j) => {
        const lines = b.split("\n");
        if (lines.every((l) => l.trim().startsWith("- "))) {
          blocks.push(
            <ul key={`${i}-${j}`}>
              {lines.map((l, k) => (
                <li key={k}>{inline(l.trim().slice(2))}</li>
              ))}
            </ul>,
          );
        } else blocks.push(<p key={`${i}-${j}`}>{inline(lines.join(" "))}</p>);
      });
  });
  return <div className="so-md">{blocks}</div>;
}
