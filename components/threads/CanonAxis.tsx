"use client";

import { useMemo } from "react";
import { BOOKS } from "@/lib/refs";
import { genreVar } from "@/lib/threads/genres";
import { bookAtY, yEdge, yOfVerse } from "@/lib/threads/geometry";
import { TOTAL_VERSES } from "@/lib/threads/types";

const LABEL_GAP = 12.5; // min px between label centers

interface Props {
  height: number;
  bookStarts: number[];
  currentBook: number; // book id
  self: [number, number];
  hoverBook: number | null; // book index
  onHoverBook: (index: number | null) => void;
  /** Links from this chapter into each book (index 0..65). */
  linksByBook: number[];
}

/** Genesis→Revelation as a vertical bar of books colored by genre, with labels that never collide. */
export function CanonAxis({ height, bookStarts, currentBook, self, hoverBook, onHoverBook, linksByBook }: Props) {
  const segments = useMemo(
    () =>
      BOOKS.map((b, i) => {
        const top = yEdge(bookStarts[i], height);
        const bottom = yEdge(bookStarts[i + 1] ?? TOTAL_VERSES + 1, height);
        return { b, i, top, h: bottom - top, mid: (top + bottom) / 2 };
      }),
    [bookStarts, height],
  );

  // Place labels by priority (current book, then longer books) wherever they don't collide.
  const labels = useMemo(() => {
    const order = [...segments].sort((a, b) => (a.b.id === currentBook ? -1 : b.b.id === currentBook ? 1 : b.h - a.h));
    const placed: typeof segments = [];
    for (const s of order) if (placed.every((p) => Math.abs(p.mid - s.mid) >= LABEL_GAP)) placed.push(s);
    return placed;
  }, [segments, currentBook]);

  const hovered = hoverBook !== null ? segments[hoverBook] : null;

  return (
    <div
      className="relative h-full select-none"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const i = bookAtY(e.clientY - r.top, height, bookStarts);
        if (i !== hoverBook) onHoverBook(i);
      }}
      onPointerLeave={() => onHoverBook(null)}
      aria-hidden
    >
      {segments.map((s) => (
        <div
          key={s.b.id}
          className="absolute left-0 w-[7px] rounded-[1px] transition-opacity"
          style={{
            top: s.top,
            height: Math.max(0.75, s.h - (s.h > 3 ? 1 : 0)),
            background: genreVar(s.b.genre),
            opacity: hoverBook === null || hoverBook === s.i ? 1 : 0.45,
          }}
        />
      ))}
      {/* This chapter */}
      <div
        className="absolute -left-[3px] w-[13px] rounded-sm border border-text bg-ground/30"
        style={{ top: yOfVerse(self[0], height) - 2, height: Math.max(4, yOfVerse(self[1], height) - yOfVerse(self[0], height) + 4) }}
      />
      {labels.map((s) => (
        <span
          key={s.b.id}
          className={`absolute left-[15px] -translate-y-1/2 whitespace-nowrap text-[0.68rem] leading-none ${s.b.id === currentBook ? "font-semibold text-text" : "text-muted"}`}
          style={{ top: s.mid }}
        >
          {s.b.name}
        </span>
      ))}
      {hovered && (
        <span
          className="pointer-events-none absolute left-[15px] z-10 -translate-y-1/2 whitespace-nowrap rounded border border-rule bg-ground px-1.5 py-0.5 text-[0.7rem] text-text"
          style={{ top: hovered.mid }}
        >
          {hovered.b.name}
          <span className="text-muted"> · {linksByBook[hovered.i]} link{linksByBook[hovered.i] === 1 ? "" : "s"}</span>
        </span>
      )}
    </div>
  );
}
