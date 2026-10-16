"use client";

import { BOOKS } from "@/lib/refs";

const TOTAL = BOOKS.reduce((n, b) => n + b.chapters, 0);
/** x offset of each book in chapter units. */
const OFFSETS = BOOKS.map((_, i) => BOOKS.slice(0, i).reduce((n, b) => n + b.chapters, 0));

/**
 * Occurrences per book along the canon, in the Iconograph's visual language: book widths are
 * proportional to chapter count, bar heights to frequency per chapter.
 */
export function Distribution({
  byBook,
  selected,
  onSelect,
}: {
  byBook: number[];
  selected: number | null;
  onSelect: (bookId: number | null) => void;
}) {
  const density = byBook.map((n, i) => n / BOOKS[i].chapters);
  const max = Math.max(...density, 1e-9);
  return (
    <div>
      <svg viewBox={`0 0 ${TOTAL} 40`} preserveAspectRatio="none" className="h-12 w-full" role="group" aria-label="Occurrences by book">
        {BOOKS.map((b, i) => {
          const x0 = OFFSETS[i];
          const h = byBook[i] ? 4 + 32 * Math.sqrt(density[i] / max) : 0;
          const isSel = selected === b.id;
          return (
            <g key={b.id}>
              <rect x={x0} y={37} width={b.chapters} height={3} className={b.id % 2 ? "fill-rule" : "fill-muted/50"} />
              {h > 0 && (
                <rect
                  x={x0 + 0.5}
                  y={36 - h}
                  width={Math.max(1.5, b.chapters - 1)}
                  height={h}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSel}
                  aria-label={`${b.name}: ${byBook[i]} occurrence${byBook[i] === 1 ? "" : "s"}${isSel ? " (showing)" : ""}`}
                  className={`cursor-pointer outline-none transition-opacity focus-visible:fill-gilt ${isSel ? "fill-gilt" : b.testament === "NT" ? "fill-text/70" : "fill-muted"} ${selected && !isSel ? "opacity-35" : ""}`}
                  onClick={() => onSelect(isSel ? null : b.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(isSel ? null : b.id);
                    }
                  }}
                >
                  <title>{`${b.name}: ${byBook[i]}`}</title>
                </rect>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[0.65rem] tracking-wide text-muted">
        <span>Genesis</span>
        <span>Matthew</span>
        <span>Revelation</span>
      </div>
    </div>
  );
}
