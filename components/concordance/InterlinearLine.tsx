"use client";

import type { InterlinearWord } from "@/lib/concordance/types";
import { scriptProps } from "./script";

interface Props {
  words: InterlinearWord[];
  language: "hbo" | "grc";
  activeKey: string | null; // lemma open in the panel: its tokens are marked
  onWord: (w: InterlinearWord, el: HTMLElement) => void;
}

/** One verse of original-language text, word by word: form, transliteration, gloss. */
export function InterlinearLine({ words, language, activeKey, onWord }: Props) {
  const s = scriptProps(language);
  return (
    <div dir={s.dir} className="mt-3 flex flex-wrap gap-x-1 gap-y-2 border-t border-dashed border-rule/80 pt-3">
      {words.map((w) => {
        const tr = !w.b; // TR-only word (behind KJV wording, not in NA27/28)
        const active = activeKey !== null && w.k === activeKey;
        return (
          <button
            key={w.p}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onWord(w, e.currentTarget);
            }}
            aria-haspopup="dialog"
            className={`group flex min-w-[2.75rem] flex-col items-center rounded px-1.5 py-1 text-center transition-colors hover:bg-surface ${active ? "ring-1 ring-gilt" : ""} ${tr ? "border border-dashed border-rule" : "border border-transparent"}`}
          >
            {/* Visible text is the accessible name; sr-only commas separate its parts. */}
            <span lang={s.lang} className={`${s.className} leading-tight ${language === "grc" ? "text-[1.2rem]" : "text-[1.45rem]"} ${active ? "text-accent" : tr ? "text-muted" : "text-text"}`}>
              {w.s}
            </span>
            {w.t && (
              <span dir="ltr" className="mt-0.5 text-[0.7rem] italic leading-tight text-muted">
                <span className="sr-only">, </span>
                {w.t}
              </span>
            )}
            <span dir="ltr" className="max-w-[9rem] text-[0.72rem] leading-tight text-text">
              {w.g && <span className="sr-only">, </span>}
              {w.g}
              {tr && (
                <sup className="ml-0.5 text-[0.6rem] not-italic text-muted">
                  TR<span className="sr-only"> (Textus Receptus only)</span>
                </sup>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
