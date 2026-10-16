"use client";

import { useEffect, useState } from "react";
import { VerseText } from "@/components/reader/VerseText";
import { scriptProps } from "@/components/concordance/script";
import type { SharedLemma } from "@/lib/concordance/types";
import { loadChapterPair, loadPassages, loadSharedLemmas, type Passage, type PairRef } from "@/lib/iconograph/data";
import type { CanonAxis } from "@/lib/iconograph/model";
import type { TranslationId } from "@/lib/reader/state";
import { chapterFromOrdinal, formatRange, verseId } from "@/lib/refs";

export type HoverTarget =
  | { type: "chapterArc"; a: number; b: number; refs: number; x: number; y: number }
  | { type: "verseArc"; from: number; toStart: number; toEnd: number; votes: number; x: number; y: number }
  | { type: "chapter"; chapter: number; links: number; x: number; y: number };

const chapterName = (c: number) => {
  const loc = chapterFromOrdinal(c)!;
  return `${loc.book.refName} ${loc.chapter}`;
};

function ordToId(axis: CanonAxis, ord: number) {
  const r = axis.verseRef(ord);
  return verseId({ book: r.book.id, chapter: r.chapter, verse: r.verse });
}

const DELAY_MS = 120;

export function HoverCard({
  target,
  axis,
  translation,
  bounds,
}: {
  target: HoverTarget;
  axis: CanonAxis;
  translation: TranslationId;
  bounds: { w: number; h: number };
}) {
  const key =
    target.type === "chapterArc"
      ? `c:${target.a}:${target.b}`
      : target.type === "verseArc"
        ? `v:${target.from}:${target.toStart}:${target.toEnd}`
        : `ch:${target.chapter}`;
  const [content, setContent] = useState<{ key: string; pair?: PairRef; passages?: Passage[] } | null>(null);
  const [shared, setShared] = useState<{ key: string; items: SharedLemma[] } | null>(null);

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      const sharedFor = (a: [number, number], b: [number, number]) =>
        loadSharedLemmas(a, b).then((d) => live && setShared({ key, items: d.shared }));
      if (target.type === "chapterArc") {
        loadChapterPair(target.a, target.b, translation).then((d) => {
          if (!live) return;
          setContent({ key, pair: d.pairs[0] });
          if (d.pairs[0]) sharedFor([d.pairs[0].from, d.pairs[0].from], [d.pairs[0].toStart, d.pairs[0].toEnd]);
        });
      } else if (target.type === "verseArc") {
        const from = ordToId(axis, target.from);
        const to: [number, number] = [ordToId(axis, target.toStart), ordToId(axis, target.toEnd)];
        loadPassages([[from, from], to], translation).then((d) => live && setContent({ key, passages: d.passages }));
        sharedFor([from, from], to);
      }
    }, DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // key captures the target identity; target object changes on every pointer move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, translation, axis]);

  const ready = content?.key === key ? content : null;

  // Place beside the pointer, flipping to stay inside the canvas.
  const W = 340;
  const left = target.x + 18 + W > bounds.w ? Math.max(8, target.x - 18 - W) : target.x + 18;
  const top = Math.min(Math.max(8, target.y - 24), Math.max(8, bounds.h - 260));

  let title = "";
  let meta = "";
  let body: React.ReactNode = null;
  if (target.type === "chapter") {
    title = chapterName(target.chapter);
    meta = `${target.links} connections shown · click to read`;
  } else if (target.type === "chapterArc") {
    title = `${chapterName(target.a)} ↔ ${chapterName(target.b)}`;
    meta = `${target.refs} cross-reference${target.refs === 1 ? "" : "s"} · strongest shown`;
    const p = ready?.pair;
    body = p ? (
      <>
        <Excerpt label={formatRange(p.from, p.from)} text={p.fromText} />
        <Excerpt label={formatRange(p.toStart, p.toEnd)} text={p.to.text} truncated={p.to.truncated} />
      </>
    ) : (
      <Skeleton />
    );
  } else {
    const a = ordToId(axis, target.from);
    const b0 = ordToId(axis, target.toStart);
    const b1 = ordToId(axis, target.toEnd);
    title = `${formatRange(a, a)} ↔ ${formatRange(b0, b1)}`;
    meta = `${target.votes} vote${target.votes === 1 ? "" : "s"} · OpenBible.info`;
    const ps = ready?.passages;
    body = ps ? (
      <>
        <Excerpt label={formatRange(ps[0].start, ps[0].end)} text={ps[0].text} />
        <Excerpt label={formatRange(ps[1].start, ps[1].end)} text={ps[1].text} truncated={ps[1].truncated} />
      </>
    ) : (
      <Skeleton />
    );
  }

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded-md border border-rule bg-ground/95 px-4 py-3 backdrop-blur-sm"
      style={{ left, top, width: W }}
    >
      <p className="font-serif text-lg leading-snug">{title}</p>
      <p className="mt-0.5 text-xs text-muted">{meta}</p>
      {body && <div className="mt-2 space-y-2.5 border-t border-rule pt-2.5">{body}</div>}
      {shared?.key === key && shared.items.length > 0 && (
        <div className="mt-2.5 border-t border-rule pt-2">
          <p className="text-[0.68rem] tracking-wide text-muted">Shared {shared.items[0].strongs[0] === "H" ? "Hebrew" : "Greek"} words</p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {shared.items.map((s) => (
              <span key={s.strongs} className="text-sm">
                <span lang={scriptProps(s.strongs[0] === "G" ? "grc" : "hbo").lang} className={scriptProps(s.strongs[0] === "G" ? "grc" : "hbo").className}>
                  {s.lemma}
                </span>{" "}
                <span className="text-xs text-muted">{s.gloss}</span>
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}

function Excerpt({ label, text, truncated }: { label: string; text: string; truncated?: boolean }) {
  return (
    <div>
      <p className="text-xs tracking-wide text-accent">{label}</p>
      <p className="line-clamp-4 font-serif text-[0.95rem] leading-relaxed text-text/90">
        {text ? <VerseText text={text} /> : <span className="italic text-muted">Not in this translation</span>}
        {truncated && " …"}
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="space-y-2">
      <div className="h-2.5 w-20 rounded bg-surface" />
      <div className="h-2.5 w-full rounded bg-surface" />
      <div className="h-2.5 w-5/6 rounded bg-surface" />
    </div>
  );
}
