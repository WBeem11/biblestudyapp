"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { VerseText } from "@/components/reader/VerseText";
import { loadPassages, type Passage } from "@/lib/iconograph/data";
import type { TranslationId } from "@/lib/reader/state";
import { formatRange } from "@/lib/refs";
import { TOTAL_VERSES, type ThreadRef } from "@/lib/threads/types";

const W = 1000; // SVG user units across the canon
const H = 30;
const BASE = 24; // baseline y; ticks rise above it, book bands sit below
const HIT_PX = 7;

/** Group key for "the same passage": the target chapter (book × 1000 + chapter). */
export const targetKey = (toStart: number) => Math.floor(toStart / 1000);

/** Center of a verse, and the left edge of a verse, in SVG units. */
const xOf = (ordinal: number) => ((ordinal - 0.5) / TOTAL_VERSES) * W;
const edge = (ordinal: number) => ((ordinal - 1) / TOTAL_VERSES) * W;

interface Props {
  verseLabel: string; // "John 3:16"
  refs: ThreadRef[]; // this verse's threads, strongest first
  maxVotes: number; // across the chapter, for consistent tick heights
  self: [number, number];
  bookStarts: number[];
  /** Target chapters reached by several verses of this chapter → how many verses. */
  shared: Map<number, number>;
  hoverKey: number | null;
  onHoverKey: (key: number | null) => void;
  pinned: ReadonlySet<string>;
  onTogglePin: (ref: ThreadRef) => void;
  onOpenList: () => void;
  translation: TranslationId;
}

/** One verse's cross-references as ticks along a Genesis→Revelation line. */
export function ThreadRail({
  verseLabel,
  refs,
  maxVotes,
  self,
  bookStarts,
  shared,
  hoverKey,
  onHoverKey,
  pinned,
  onTogglePin,
  onOpenList,
  translation,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; px: number } | null>(null);
  const [text, setText] = useState<{ key: string; p: Passage } | null>(null);
  const hovered = hover ? refs[hover.i] : null;
  const hoveredId = hovered ? `${hovered[1]}-${hovered[2]}` : null;

  // Ticks drawn weakest first so the strongest sit on top.
  const order = useMemo(() => refs.map((_, i) => i).reverse(), [refs]);

  useEffect(() => {
    if (!hovered || !hoveredId) return;
    let live = true;
    const t = setTimeout(() => {
      loadPassages([[hovered[1], hovered[2]]], translation).then((d) => live && setText({ key: hoveredId, p: d.passages[0] }));
    }, 90);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [hovered, hoveredId, translation]);

  function nearest(clientX: number): { i: number; px: number } | null {
    const r = svgRef.current!.getBoundingClientRect();
    const px = clientX - r.left;
    let best: { i: number; px: number } | null = null;
    let bestD = HIT_PX;
    for (let i = 0; i < refs.length; i++) {
      const tx = (xOf(refs[i][4]) / W) * r.width;
      const d = Math.abs(tx - px);
      // Prefer the stronger reference on ties (refs are strongest first).
      if (d < bestD) {
        bestD = d;
        best = { i, px: tx };
      }
    }
    return best;
  }

  const strongest = refs.slice(0, 3).map(([, s, e]) => formatRange(s, e));
  const label = refs.length
    ? `${verseLabel}: ${refs.length} cross-reference${refs.length === 1 ? "" : "s"} across Scripture. Strongest: ${strongest.join("; ")}.`
    : `${verseLabel}: no cross-references.`;

  return (
    <div className="relative flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        className={`h-[2.6rem] min-w-0 flex-1 ${refs.length ? "cursor-pointer" : ""}`}
        onPointerMove={(e) => {
          const n = nearest(e.clientX);
          if (n?.i === hover?.i) return;
          setHover(n);
          onHoverKey(n ? targetKey(refs[n.i][1]) : null);
        }}
        onPointerLeave={() => {
          setHover(null);
          onHoverKey(null);
        }}
        onClick={(e) => {
          const n = nearest(e.clientX);
          if (n) onTogglePin(refs[n.i]);
        }}
      >
        {/* Book bands and the Testament divide */}
        {bookStarts.map((start, b) => {
          const end = bookStarts[b + 1] ?? TOTAL_VERSES + 1;
          return (
            <rect
              key={b}
              x={edge(start)}
              y={BASE + 2}
              width={Math.max(0.5, edge(end) - edge(start) - 0.6)}
              height={3}
              className={b % 2 ? "fill-rule" : "fill-muted"}
              opacity={b >= 39 ? 0.75 : 0.4}
            />
          );
        })}
        <line x1={0} x2={W} y1={BASE + 0.5} y2={BASE + 0.5} className="stroke-rule" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {/* You are here */}
        <rect x={edge(self[0]) - 1} y={2} width={Math.max(3, edge(self[1] + 1) - edge(self[0]) + 2)} height={BASE - 2} className="fill-gilt" opacity={0.22} />

        {order.map((i) => {
          const [, s, e, votes, o] = refs[i];
          const key = targetKey(s);
          const t = Math.sqrt(votes / maxVotes);
          const h = 5 + 15 * t;
          const isHover = hover?.i === i;
          const linked = hoverKey !== null && hoverKey === key;
          const isPinned = pinned.has(`${s}-${e}`);
          const isShared = (shared.get(key) ?? 0) >= 3;
          const x = xOf(o);
          return (
            <g key={`${s}-${e}`} data-target={`${s}-${e}`}>
              <line
                x1={x}
                x2={x}
                y1={BASE - (isHover || linked ? h + 3 : h)}
                y2={BASE}
                vectorEffect="non-scaling-stroke"
                strokeWidth={isHover || isPinned ? 2.25 : linked ? 1.75 : 1.25}
                className={isHover || linked || isPinned ? "stroke-gilt" : isShared ? "stroke-gilt" : "stroke-text"}
                opacity={isHover || linked || isPinned ? 1 : isShared ? 0.65 + 0.35 * t : 0.4 + 0.5 * t}
              />
              {isPinned && <circle cx={x} cy={BASE - h - 4} r={2.2} className="fill-gilt" vectorEffect="non-scaling-stroke" />}
            </g>
          );
        })}
      </svg>

      <button
        type="button"
        onClick={onOpenList}
        disabled={!refs.length}
        className="w-7 shrink-0 text-right text-xs tabular-nums text-muted transition-colors hover:text-accent disabled:hover:text-muted"
        aria-label={`List ${refs.length} cross-references for ${verseLabel}`}
        title="List all"
      >
        {refs.length || "·"}
      </button>

      {hovered && hover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full z-20 mb-1 w-72 rounded-md border border-rule bg-ground/95 px-3 py-2 backdrop-blur-sm"
          style={{ left: `clamp(0px, calc(${hover.px}px - 9rem), calc(100% - 18rem))` }}
        >
          <p className="flex items-baseline justify-between gap-2 text-xs">
            <span className="tracking-wide text-accent">{formatRange(hovered[1], hovered[2])}</span>
            <span className="text-muted">
              {hovered[3]} vote{hovered[3] === 1 ? "" : "s"}
              {(shared.get(targetKey(hovered[1])) ?? 0) >= 2 && ` · ${shared.get(targetKey(hovered[1]))} verses here`}
            </span>
          </p>
          <p className="mt-1 line-clamp-4 font-serif text-[0.95rem] leading-snug">
            {text?.key === hoveredId ? <VerseText text={text.p.text} /> : <span className="text-muted">…</span>}
            {text?.key === hoveredId && text.p.truncated && " …"}
          </p>
          <p className="mt-1 text-[0.65rem] text-muted">{pinned.has(hoveredId!) ? "Click to unpin" : "Click to pin below the verse"}</p>
        </div>
      )}
    </div>
  );
}
