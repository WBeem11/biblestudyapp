"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReaderProps } from "@/components/reader/types";
import { VerseText } from "@/components/reader/VerseText";
import type { ReaderState, TranslationId } from "@/lib/reader/state";
import { BOOKS } from "@/lib/refs";
import { genreVar } from "@/lib/threads/genres";
import { loadThreads } from "@/lib/threads/data";
import type { ChapterThreads, ThreadRef } from "@/lib/threads/types";
import { CanonAxis } from "./CanonAxis";
import { ThreadCanvas } from "./ThreadCanvas";
import { VersePanel } from "./VersePanel";

interface Props extends ReaderProps {
  state: ReaderState;
  update: (patch: Partial<ReaderState>) => void;
  selectVerse: (verse: number | null) => void;
  chapterHref: (link: { href: string }) => string;
}

/**
 * Read a whole chapter while seeing where every verse connects across Scripture: the text on the
 * left, a thread from each verse to the canon axis, and the selected verse's references in full.
 */
export function ThreadsView({ book, chapter, verses, translations, prev, next, state, update, selectVerse, chapterHref }: Props) {
  const active = state.translations;
  const t = active[0];
  const testament = book.testament === "OT" ? "Old Testament" : "New Testament";
  const genre = BOOKS[book.id - 1].genre;
  const key = `${book.id}:${chapter}`;

  const [threads, setThreads] = useState<{ key: string; data: ChapterThreads } | null>(null);
  const data = threads?.key === key ? threads.data : null;
  useEffect(() => {
    let live = true;
    loadThreads(book.id, chapter)
      .then((d) => live && setThreads({ key, data: d }))
      .catch(console.error);
    return () => {
      live = false;
    };
  }, [book.id, chapter, key]);

  const index = useMemo(() => {
    const byVerse = new Map<number, ThreadRef[]>();
    const linksByBook = new Array(66).fill(0);
    let maxVotes = 1;
    for (const r of data?.refs ?? []) {
      if (!byVerse.has(r[0])) byVerse.set(r[0], []);
      byVerse.get(r[0])!.push(r);
      linksByBook[Math.floor(r[1] / 1_000_000) - 1]++;
      maxVotes = Math.max(maxVotes, r[3]);
    }
    return { byVerse, linksByBook, maxVotes };
  }, [data]);

  const anchors = useRef(new Map<number, HTMLElement>());
  const rows = useRef(new Map<number, HTMLElement>());
  const [hoverVerse, setHoverVerse] = useState<number | null>(null);
  const [hoverBook, setHoverBook] = useState<number | null>(null);

  // The diagram column is sticky and fills the viewport under the top bar.
  const stickyRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setHeight(Math.round(e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const selected = state.verse ? verses.find((v) => v.verse === state.verse) : undefined;

  // Keep the selected verse on screen (panel arrows, j/k, deep links).
  useEffect(() => {
    if (!state.verse) return;
    const el = rows.current.get(state.verse);
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Below lg the panel is a bottom sheet covering ~60% of the screen: keep the verse above it.
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    if (r.top >= 64 && r.bottom <= window.innerHeight * (wide ? 1 : 0.4)) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: wide ? "center" : "start", behavior: smooth ? "smooth" : "auto" });
  }, [state.verse]);

  const makePrimary = (id: TranslationId) => update({ translations: [id, ...active.filter((x) => x !== id)] });

  return (
    <div className="mx-auto grid w-full max-w-[100rem] px-5 sm:px-8 lg:grid-cols-[minmax(0,30rem)_minmax(6rem,1fr)_7.5rem_minmax(17rem,20rem)] xl:grid-cols-[minmax(0,36rem)_minmax(10rem,1fr)_8.5rem_minmax(20rem,24rem)]">
      <article aria-labelledby="chapter-title" className="pb-[50dvh] pt-10 lg:pb-24 lg:pr-4">
        <header>
          <p className="flex items-center gap-2 text-xs text-muted">
            <span aria-hidden className="h-[3px] w-3 rounded-full" style={{ background: genreVar(genre) }} />
            {book.name} · {testament}
          </p>
          <h1 id="chapter-title" className="mt-1 font-serif text-4xl font-normal tracking-tight">
            {book.refName} {chapter}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {prev ? (
              <Link href={chapterHref(prev)} className="rounded-md border border-rule px-2.5 py-1 text-xs text-muted transition-colors hover:text-text">
                ‹ Previous chapter
              </Link>
            ) : null}
            {next ? (
              <Link href={chapterHref(next)} className="rounded-md border border-rule px-2.5 py-1 text-xs text-muted transition-colors hover:text-text">
                Next chapter ›
              </Link>
            ) : null}
            <span className="ml-auto flex items-center gap-1" role="group" aria-label="Translation">
              {translations.map((tr) => (
                <button
                  key={tr.id}
                  type="button"
                  aria-pressed={tr.id === t}
                  title={tr.name}
                  onClick={() => makePrimary(tr.id)}
                  className={`rounded-full border px-2.5 py-0.5 text-[0.7rem] tracking-[0.12em] ${tr.id === t ? "border-text/70 text-text" : "border-rule text-muted hover:text-text"}`}
                >
                  {tr.id}
                </button>
              ))}
              <button
                type="button"
                aria-pressed
                onClick={() => update({ threads: false })}
                title="Back to the parallel reader"
                className="ml-1 rounded-full border border-accent/70 px-2.5 py-0.5 text-[0.7rem] tracking-[0.08em] text-accent"
              >
                Threads
              </button>
            </span>
          </div>
        </header>

        <ol className="mt-6 space-y-0.5" aria-label={`${book.refName} ${chapter}`}>
          {verses.map((v) => {
            const isSel = v.verse === state.verse;
            const n = data ? (index.byVerse.get(v.verse)?.length ?? 0) : null;
            const text = v.text[t];
            return (
              <li
                key={v.id}
                ref={(el) => {
                  if (el) rows.current.set(v.verse, el);
                  else rows.current.delete(v.verse);
                }}
                onMouseEnter={() => setHoverVerse(v.verse)}
                onMouseLeave={() => setHoverVerse(null)}
                onClick={() => {
                  if (window.getSelection()?.toString()) return;
                  selectVerse(isSel ? null : v.verse);
                }}
                className={`grid cursor-pointer scroll-mt-24 grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] gap-x-2 rounded-md border-l-2 px-2 py-2 transition-colors ${isSel ? "border-gilt bg-surface" : "border-transparent hover:bg-surface/60"}`}
              >
                <button
                  id={`v${v.verse}`}
                  type="button"
                  aria-pressed={isSel}
                  aria-label={`Verse ${v.verse}${n !== null ? `, ${n} cross-references` : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectVerse(isSel ? null : v.verse);
                  }}
                  className={`verse-num self-start pt-[0.35rem] text-right font-serif text-[0.9rem] leading-none ${isSel ? "text-accent" : "text-muted"}`}
                >
                  {v.verse}
                </button>
                <p className={`font-serif text-[1.0625rem] leading-[1.65] ${text ? "" : "text-[0.95rem] italic text-muted"}`}>
                  {text ? <VerseText text={text} /> : "Not included in this translation’s base text."}
                </p>
                <span
                  ref={(el) => {
                    if (el) anchors.current.set(v.verse, el);
                    else anchors.current.delete(v.verse);
                  }}
                  aria-hidden
                  className="self-start pt-[0.35rem] text-right text-xs tabular-nums text-muted"
                >
                  {n ?? ""}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-10 text-center text-[0.7rem] text-muted">
          Threads drawn from OpenBible.info cross-references (positive votes), colored by the genre they reach.
        </p>
      </article>

      {/* Threads + canon axis: sticky beside the text (wide screens). */}
      <div ref={stickyRef} className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] hidden h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] lg:block">
        {data && height > 0 && (
          <ThreadCanvas
            height={height}
            refsByVerse={index.byVerse}
            maxVotes={index.maxVotes}
            anchors={anchors}
            selected={state.verse}
            hoverVerse={hoverVerse}
            hoverBookId={hoverBook !== null ? hoverBook + 1 : null}
          />
        )}
      </div>
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] hidden h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] lg:block">
        {data && height > 0 && (
          <CanonAxis
            height={height}
            bookStarts={data.bookStarts}
            currentBook={book.id}
            self={data.self}
            hoverBook={hoverBook}
            onHoverBook={setHoverBook}
            linksByBook={index.linksByBook}
          />
        )}
        <p className="sr-only">
          The threads diagram links each verse to where its cross-references land, Genesis to Revelation. Select a verse to
          list them.
        </p>
      </div>

      {/* Selected verse: sticky column on wide screens, bottom sheet on small ones. */}
      <aside
        aria-label={selected ? `Cross-references for ${book.refName} ${chapter}:${selected.verse}` : "Verse details"}
        className={`${selected ? "fixed inset-x-0 bottom-0 z-30 flex max-h-[60dvh] border-t pb-[env(safe-area-inset-bottom,0px)]" : "hidden"} flex-col border-rule bg-ground lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:z-auto lg:flex lg:h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] lg:max-h-none lg:border-l lg:border-t-0 lg:pb-0`}
      >
        {selected ? (
          <VersePanel
            key={selected.id}
            verseId={selected.id}
            label={`${book.refName} ${chapter}:${selected.verse}`}
            context={`${book.name} · ${testament}`}
            genre={genre}
            text={selected.text[t]}
            translations={active}
            iconographHref={`/iconograph?focus=${book.slug}-${chapter}`}
            onPrev={selected.verse > 1 ? () => selectVerse(selected.verse - 1) : null}
            onNext={selected.verse < verses.length ? () => selectVerse(selected.verse + 1) : null}
            onClose={() => selectVerse(null)}
          />
        ) : (
          <div className="px-5 pt-10 text-sm text-muted">
            <p className="font-serif text-xl text-text">Select a verse</p>
            <p className="mt-2 leading-relaxed">
              Choose any verse to follow its threads: where it points across Scripture, grouped by book, with each passage
              to read in full.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
