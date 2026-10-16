"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { describeMorph } from "@/lib/concordance/morph";
import type { InterlinearChapter, InterlinearWord } from "@/lib/concordance/types";
import { scriptProps } from "./script";

interface Props {
  word: InterlinearWord;
  anchor: HTMLElement;
  data: InterlinearChapter;
  onOpenLemma: (strongs: string) => void;
  onClose: () => void;
}

const W = 320;

export function WordPopover({ word, anchor, data, onOpenLemma, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const lemma = word.k ? data.lemmas[word.k] : undefined;
  const s = scriptProps(data.language);
  const morph = describeMorph(word.m, data.morph);

  // Place under the word (or above if there's no room); a bottom sheet on narrow screens.
  const place = useCallback(() => {
    const r = anchor.getBoundingClientRect();
    const h = ref.current?.offsetHeight ?? 240;
    const above = r.bottom + 8 + h > window.innerHeight && r.top - 8 - h > 56;
    setPos({
      left: Math.min(Math.max(12, r.left + r.width / 2 - W / 2), window.innerWidth - W - 12),
      top: above ? r.top - 8 - h : r.bottom + 8,
      above,
    });
    return r;
  }, [anchor]);
  useLayoutEffect(() => {
    place();
  }, [place]);

  // Focus once positioned: a visibility:hidden element can't take focus.
  const placed = pos !== null;
  useEffect(() => {
    if (placed) ref.current?.focus({ preventScroll: true });
  }, [placed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        anchor.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    };
    // Follow the word as the page moves (scrolling, late font loads); close once it's off-screen.
    const onScroll = () => {
      const r = place();
      if (r.bottom < 56 || r.top > window.innerHeight) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", onScroll);
    };
  }, [anchor, onClose, place]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${word.s}${lemma ? `, from ${lemma[0]}` : ""}`}
      tabIndex={-1}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-40 rounded-md border border-rule bg-ground p-4 outline-none max-sm:!inset-x-3 max-sm:!bottom-3 max-sm:!top-auto max-sm:!w-auto"
      style={{ width: W, left: pos?.left ?? -9999, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div dir={s.dir} className="min-w-0">
          <p lang={s.lang} className={`${s.className} text-3xl leading-tight`}>
            {lemma?.[0] ?? word.s}
          </p>
        </div>
        <span className="shrink-0 pt-1 text-[0.7rem] tracking-wider text-muted">{word.k}</span>
      </div>
      {lemma?.[1] && <p className="mt-1 font-serif text-lg">{lemma[1]}</p>}

      <dl className="mt-3 space-y-1.5 border-t border-rule pt-3 text-sm">
        <div className="flex gap-3">
          <dt className="w-16 shrink-0 text-xs text-muted">Form</dt>
          <dd>
            <span lang={s.lang} dir={s.dir} className={`${s.className} text-base`}>
              {word.s}
            </span>
            {word.t && <span className="ml-2 italic text-muted">{word.t}</span>}
          </dd>
        </div>
        {word.g && (
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-xs text-muted">Here</dt>
            <dd>{word.g}</dd>
          </div>
        )}
        {morph && (
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-xs text-muted">Parsing</dt>
            <dd className="text-text/90">{morph}</dd>
          </div>
        )}
        {!word.b && (
          <p className="pt-1 text-xs text-muted">Found in the Textus Receptus (behind the KJV), not in NA27/28.</p>
        )}
      </dl>

      {word.k && lemma && (
        <button
          type="button"
          onClick={() => onOpenLemma(word.k!)}
          className="mt-4 w-full rounded-full border border-accent/60 px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/10"
        >
          See all {lemma[2].toLocaleString()} occurrence{lemma[2] === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}
