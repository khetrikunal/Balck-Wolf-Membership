import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="border border-border bg-muted px-1">{part.slice(1, -1)}</code>;
    return part;
  });
}

/** Renders the simple Markdown commonly used in product descriptions, without HTML injection. */
export function RichDescription({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return <div className="space-y-4 text-base leading-7 text-muted-foreground">
    {blocks.map((block, i) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const heading = lines[0].match(/^(#{1,6})\s+(.+)$/);
      if (heading && lines.length === 1) return <h3 key={i} className="font-sans text-base font-semibold text-foreground">{inline(heading[2])}</h3>;
      if (lines.every((line) => /^[-*+]\s+/.test(line))) return <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((line, j) => <li key={j}>{inline(line.replace(/^[-*+]\s+/, ""))}</li>)}</ul>;
      return <p key={i}>{lines.map((line, j) => <span key={j}>{j > 0 && <br />}{inline(line.replace(/^#{1,6}\s+/, "").replace(/^[-*+]\s+/, ""))}</span>)}</p>;
    })}
  </div>;
}
