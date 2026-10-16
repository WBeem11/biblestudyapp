"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InterlinearLine } from "@/components/concordance/InterlinearLine";
import { LemmaPanel } from "@/components/concordance/LemmaPanel";
import { WordPopover } from "@/components/concordance/WordPopover";
import { ThreadsView } from "@/components/threads/ThreadsView";
import { loadInterlinear } from "@/lib/concordance/data";
import type { InterlinearChapter, InterlinearWord } from "@/lib/concordance/types";
import { readerQuery, type ReaderState, type TranslationId } from "@/lib/reader/state";
import { IconographStrip } from "@/components/iconograph/IconographStrip";
import { chapterOrdinal } from "@/lib/refs";
import { CrossRefSheet } from "./CrossRefSheet";
import type { ReaderProps } from "./types";
import { VerseText } from "./VerseText";

const GENRE_LABEL: Record<string, string> = {
  law: "The Law",
  history: "History",
  wisdom: "Wisdom & Poetry",
  prophets: "The Prophets",
  gospels: "The Gospels",
  acts: "Acts",
  epistles: "The Epistles",
  apocalyptic: "Apocalyptic",
};

interface Props extends ReaderProps {
  state: ReaderState;
  /** Absent in the prerendered fallback, which is replaced as soon as the URL is known. */
  onStateChange?: (next: ReaderState) => void;
}

export function ParallelReader({ book, chapter, verses, translations, prev, next, state, onStateChange }: Props) {
  const router = useRouter();
  const active = state.translations;
  const [mobileTab, setMobileTab] = useState<TranslationId>(active[0]);
  const shownOnMobile = active.includes(mobileTab) ? mobileTab : active[0];
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const selected = state.verse ? verses.find((v) => v.verse === state.verse) : undefined;
  const side = state.lemma ? "lemma" : selected ? "refs" : null;

  const update = (patch: Partial<ReaderState>) => onStateChange?.({ ...state, ...patch });
  // The URL (and so `state`) updates asynchronously; rapid key repeats must see the latest selection.
  const verseNow = useRef(state.verse);
  useEffect(() => {
    verseNow.current = state.verse;
  }, [state.verse]);
  const selectVerse = (verse: number | null) => {
    verseNow.current = verse;
    update({ verse });
  };
  // Chapter links keep the reader's view (translations, interlinear, open lemma) but not the verse.
  const chapterHref = (link: { href: string }) =>
    link.href + readerQuery({ translations: active, interlinear: state.interlinear, lemma: state.lemma, threads: state.threads });

  // Original-language interlinear: fetched only when switched on.
  const [interlinear, setInterlinear] = useState<{ key: string; data: InterlinearChapter } | null>(null);
  const ilKey = `${book.id}:${chapter}`;
  const ilData = state.interlinear && interlinear?.key === ilKey ? interlinear.data : null;
  useEffect(() => {
    if (!state.interlinear) return;
    let live = true;
    loadInterlinear(book.id, chapter)
      .then((data) => live && setInterlinear({ key: ilKey, data }))
      .catch(console.error);
    return () => {
      live = false;
    };
  }, [state.interlinear, book.id, chapter, ilKey]);
  const wordsByVerse = useMemo(() => {
    const m = new Map<number, InterlinearWord[]>();
    for (const w of ilData?.words ?? []) {
      if (!m.has(w.v)) m.set(w.v, []);
      m.get(w.v)!.push(w);
    }
    return m;
  }, [ilData]);
  const [popover, setPopover] = useState<{ word: InterlinearWord; anchor: HTMLElement } | null>(null);
  const closePopover = useCallback(() => setPopover(null), []);
  const originalLabel = book.testament === "OT" ? "Hebrew" : "Greek";

  // Bring the selected verse into view when it changes (deep links, j/k), unless already visible.
  // Re-checked once the interlinear arrives, since its rows push verses down the page.
  const ilLoaded = ilData !== null;
  useEffect(() => {
    if (!state.verse) return;
    const el = rowRefs.current.get(state.verse);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const sheetCovers = window.matchMedia("(max-width: 1023px)").matches ? window.innerHeight * 0.55 : 0;
    if (r.top >= 112 && r.bottom <= window.innerHeight - sheetCovers) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: sheetCovers ? "start" : "center", behavior: smooth ? "smooth" : "auto" });
  }, [state.verse, ilLoaded]);

  function toggleTranslation(id: TranslationId) {
    if (active.includes(id)) {
      if (active.length > 1) update({ translations: active.filter((t) => t !== id) });
    } else update({ translations: [...active, id] });
  }


  // Reader shortcuts: j/k move between verses, Esc clears, ←/→ change chapter.
  useEffect(() => {
    if (!onStateChange) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable], dialog")) return;
      const n = verses.length;
      const cur = verseNow.current ?? 0;
      if (e.key === "j") selectVerse(Math.min(cur + 1, n));
      else if (e.key === "k") selectVerse(Math.max(cur - 1, 1));
      else if (e.key === "Escape" && state.lemma) update({ lemma: null });
      else if (e.key === "Escape" && verseNow.current) selectVerse(null);
      else if (e.key === "ArrowLeft" && prev) router.push(chapterHref(prev));
      else if (e.key === "ArrowRight" && next) router.push(chapterHref(next));
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const twoUp = active.length > 1;
  const cols = twoUp
    ? "grid-cols-[2.25rem_minmax(0,1fr)] md:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)]"
    : "grid-cols-[2.25rem_minmax(0,1fr)] md:grid-cols-[2.5rem_minmax(0,1fr)]";
  // On narrow screens two translations collapse to one tabbed column.
  const cellVisibility = (id: TranslationId) => (twoUp && id !== shownOnMobile ? "max-md:hidden" : "");
  const nameOf = (id: TranslationId) => translations.find((t) => t.id === id)?.name ?? id;

  if (state.threads && onStateChange) {
    return (
      <ThreadsView
        book={book}
        chapter={chapter}
        verses={verses}
        translations={translations}
        prev={prev}
        next={next}
        state={state}
        update={update}
        selectVerse={selectVerse}
        chapterHref={chapterHref}
      />
    );
  }

  return (
    <div
      className={`mx-auto w-full px-5 sm:px-8 ${side ? "max-w-[84rem] lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14" : twoUp ? "max-w-6xl" : "max-w-3xl"}`}
    >
      <article
        aria-labelledby="chapter-title"
        className={`pb-[50dvh] pt-14 lg:pb-24 ${twoUp ? "" : "w-full max-w-3xl justify-self-center"}`}
      >
        <header className="mb-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div>
            <p className="small-caps text-sm tracking-[0.12em] text-muted">
              {GENRE_LABEL[book.genre]} · {book.testament === "OT" ? "Old Testament" : "New Testament"}
            </p>
            <h1 id="chapter-title" className="mt-3 font-serif text-5xl font-normal tracking-tight sm:text-6xl">
              {book.refName} <span className="text-muted">{chapter}</span>
            </h1>
          </div>

          <div role="group" aria-label="Translations" className="flex items-center gap-1.5">
            {translations.map((t) => {
              const on = active.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  title={t.name}
                  disabled={!onStateChange}
                  onClick={() => toggleTranslation(t.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs tracking-[0.14em] transition-colors ${on ? "border-text/70 text-text" : "border-rule text-muted hover:border-text/40 hover:text-text"}`}
                >
                  {t.id}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={state.interlinear}
              disabled={!onStateChange}
              onClick={() => update({ interlinear: !state.interlinear })}
              title={`Show the ${originalLabel} text word by word`}
              className={`ml-2 rounded-full border px-3.5 py-1.5 text-xs tracking-[0.08em] transition-colors ${state.interlinear ? "border-accent/70 text-accent" : "border-rule text-muted hover:border-text/40 hover:text-text"}`}
            >
              {originalLabel}
            </button>
            <button
              type="button"
              aria-pressed={state.threads}
              disabled={!onStateChange}
              onClick={() => update({ threads: true, verse: state.verse ?? 1 })}
              title="Show where every verse connects across Scripture"
              className={`rounded-full border px-3.5 py-1.5 text-xs tracking-[0.08em] transition-colors ${state.threads ? "border-accent/70 text-accent" : "border-rule text-muted hover:border-text/40 hover:text-text"}`}
            >
              Threads
            </button>
            {twoUp && (
              <button
                type="button"
                onClick={() => update({ translations: [...active].reverse() })}
                disabled={!onStateChange}
                className="ml-1 rounded-full px-2 py-1.5 text-sm text-muted transition-colors hover:text-text"
                aria-label="Swap translation order"
                title="Swap order"
              >
                ⇄
              </button>
            )}
          </div>
        </header>

        <IconographStrip
          chapterOrdinal={chapterOrdinal(book.id, chapter)}
          label={`${book.refName} ${chapter}`}
          focusSlug={`${book.slug}-${chapter}`}
          translations={active}
        />

        {twoUp && (
          <div role="tablist" aria-label="Translation shown" className="mb-6 flex border-b border-rule md:hidden">
            {active.map((id) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={id === shownOnMobile}
                onClick={() => setMobileTab(id)}
                className={`-mb-px border-b px-4 py-2.5 text-xs tracking-[0.14em] ${id === shownOnMobile ? "border-accent text-text" : "border-transparent text-muted"}`}
              >
                {id}
              </button>
            ))}
          </div>
        )}

        <div className={`grid ${cols} gap-x-6 md:gap-x-10`}>
          {/* Column heads stay pinned under the top bar while reading long chapters. */}
          <div className="col-span-full grid grid-cols-subgrid border-b border-rule bg-ground/95 py-3 backdrop-blur-sm max-md:hidden md:sticky md:top-[calc(3.5rem+env(safe-area-inset-top,0px))] md:z-10">
            <span />
            {active.map((id) => (
              <span key={id} className="text-xs tracking-[0.14em] text-muted">
                {id} <span className="tracking-normal text-muted">· {nameOf(id)}</span>
              </span>
            ))}
          </div>

          {verses.map((v) => {
            const isSelected = v.verse === state.verse;
            const density = Math.min(1, 0.25 + v.refCount / 40);
            return (
              <div
                key={v.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(v.verse, el);
                  else rowRefs.current.delete(v.verse);
                }}
                role="group"
                aria-labelledby={`v${v.verse}`}
                onClick={() => {
                  // Leave text selection (copying) alone.
                  if (window.getSelection()?.toString()) return;
                  selectVerse(isSelected ? null : v.verse);
                }}
                className={`relative col-span-full grid scroll-mt-28 grid-cols-subgrid rounded-sm py-2.5 transition-colors duration-200 ${onStateChange ? "cursor-pointer" : ""} ${isSelected ? "bg-surface" : "hover:bg-surface/50"}`}
              >
                <div className="flex flex-col items-end gap-1.5 pt-[0.3rem]">
                  <button
                    id={`v${v.verse}`}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`Verse ${v.verse}${v.refCount ? `, ${v.refCount} cross-references` : ""}`}
                    disabled={!onStateChange}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectVerse(isSelected ? null : v.verse);
                    }}
                    className={`verse-num font-serif text-[0.95rem] leading-none transition-colors ${isSelected ? "text-accent" : "text-muted"}`}
                  >
                    {v.verse}
                  </button>
                  {v.refCount > 0 && (
                    <span aria-hidden className="h-1 w-1 rounded-full bg-gilt" style={{ opacity: density }} />
                  )}
                </div>
                {active.map((id) => {
                  const text = v.text[id];
                  return (
                    <p
                      key={id}
                      className={`font-serif text-[1.1875rem] leading-[1.7] ${cellVisibility(id)} ${text ? "" : "text-[1rem] italic text-muted"} ${text && v.verse === 1 ? "drop-cap" : ""}`}
                    >
                      {text ? <VerseText text={text} /> : "Not included in this translation’s base text."}
                    </p>
                  );
                })}
                {ilData && wordsByVerse.has(v.verse) && (
                  <div className="col-start-2 -col-end-1">
                    <InterlinearLine
                      words={wordsByVerse.get(v.verse)!}
                      language={ilData.language}
                      activeKey={state.lemma}
                      onWord={(word, anchor) => setPopover({ word, anchor })}
                    />
                  </div>
                )}
                {state.interlinear && !ilData && (
                  // Reserve roughly the interlinear's footprint so verses don't jump when it arrives.
                  // Original-language word counts run ~0.6× (Hebrew) / ~0.85× (Greek) the English.
                  <div aria-hidden className="col-start-2 -col-end-1 mt-3 flex flex-wrap gap-x-1 gap-y-2 border-t border-dashed border-rule pt-3">
                    {Array.from({ length: Math.max(3, Math.round(((v.text.BSB ?? v.text.KJV ?? "").split(" ").length) * (book.testament === "OT" ? 0.6 : 0.85))) }, (_, i) => (
                      <span key={i} className="h-[3.6rem] w-[3.4rem] rounded bg-surface/60" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <nav aria-label="Chapters" className="mt-16 flex items-center justify-between border-t border-rule pt-6 text-sm">
          {prev ? (
            <Link href={chapterHref(prev)} className="text-muted transition-colors hover:text-text">
              ← {prev.label}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={chapterHref(next)} className="text-muted transition-colors hover:text-text">
              {next.label} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
        <p className="mt-8 hidden text-center text-xs text-muted md:block">
          <kbd>j</kbd> <kbd>k</kbd> verses · <kbd>←</kbd> <kbd>→</kbd> chapters · <kbd>⌘K</kbd> go to
        </p>
        {state.interlinear && (
          <p className="mt-6 text-center text-[0.7rem] text-muted">
            {originalLabel} text, glosses and parsing: STEPBible.org{" "}
            {book.testament === "OT" ? "TAHOT (Leningrad Codex)" : "TAGNT (NA27/28; TR-only words marked)"} · CC BY 4.0
          </p>
        )}
      </article>

      {side === "lemma" && state.lemma && (
        <LemmaPanel
          key={state.lemma}
          strongs={state.lemma}
          translations={active}
          onSelectLemma={(lemma) => update({ lemma })}
          onClose={() => update({ lemma: null })}
        />
      )}
      {side === "refs" && selected && (
        <CrossRefSheet
          key={selected.id}
          verseId={selected.id}
          label={`${book.refName} ${chapter}:${selected.verse}`}
          translation={active[0]}
          translations={active}
          interlinear={state.interlinear}
          threads={state.threads}
          onClose={() => selectVerse(null)}
        />
      )}

      {popover && ilData && (
        <WordPopover
          key={`${popover.word.v}:${popover.word.p}`}
          word={popover.word}
          anchor={popover.anchor}
          data={ilData}
          onOpenLemma={(lemma) => {
            setPopover(null);
            update({ lemma });
          }}
          onClose={closePopover}
        />
      )}
    </div>
  );
}
