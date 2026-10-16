import { MARK_CLOSE, MARK_OPEN } from "@/lib/search/query";
import { VerseText } from "@/components/reader/VerseText";

/** Render an FTS snippet: text between private-use markers becomes <mark>. No HTML is parsed. */
export function Snippet({ text }: { text: string }) {
  const parts = text.split(new RegExp(`(${MARK_OPEN}[^${MARK_CLOSE}]*${MARK_CLOSE})`));
  return parts.map((p, i) =>
    p.startsWith(MARK_OPEN) ? (
      <mark key={i} className="rounded-sm bg-accent/20 px-0.5 text-text">
        <VerseText text={p.slice(1, -1)} />
      </mark>
    ) : (
      <VerseText key={i} text={p} />
    ),
  );
}
