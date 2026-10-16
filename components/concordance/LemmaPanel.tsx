"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { PanelClose, SidePanel } from "@/components/reader/SidePanel";
import { VerseText } from "@/components/reader/VerseText";
import { loadLemma, loadOccurrences } from "@/lib/concordance/data";
import type { LemmaDetail, Occurrence } from "@/lib/concordance/types";
import { readerQuery, type TranslationId } from "@/lib/reader/state";
import { bookById, decodeVerseId, formatRange } from "@/lib/refs";
import { Distribution } from "./Distribution";
import { scriptProps } from "./script";

const SOURCE: Record<string, string> = {
  grc: "Abbott-Smith, Manual Greek Lexicon of the NT · via STEPBible TBESG (CC BY)",
  hbo: "Brief lexicon based on Brown-Driver-Briggs · via STEPBible TBESH (CC BY)",
  arc: "Brief lexicon based on Brown-Driver-Briggs · via STEPBible TBESH (CC BY)",
};

interface Props {
  strongs: string;
  translations: TranslationId[];
  onSelectLemma: (strongs: string) => void;
  onClose: () => void;
}

export function LemmaPanel({ strongs, translations, onSelectLemma, onClose }: Props) {
  const t = translations[0];
  const [lemma, setLemma] = useState<{ key: string; data: LemmaDetail | null } | null>(null);
  const [book, setBook] = useState<number | null>(null);
  const [pages, setPages] = useState<{ key: string; total: number; items: Occurrence[] } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const listKey = `${strongs}:${t}:${book ?? ""}`;
  const detail = lemma?.key === strongs ? lemma.data : undefined;
  const list = pages?.key === listKey ? pages : null;

  useEffect(() => {
    let live = true;
    loadLemma(strongs)
      .then((d) => live && setLemma({ key: strongs, data: d }))
      .catch(() => live && setLemma({ key: strongs, data: null }));
    return () => {
      live = false;
    };
  }, [strongs]);

  useEffect(() => {
    let live = true;
    loadOccurrences(strongs, t, 0, book ?? undefined).then((p) => live && setPages({ key: listKey, total: p.total, items: p.items }));
    return () => {
      live = false;
    };
  }, [strongs, t, book, listKey]);

  function loadMore() {
    if (!list) return;
    setLoadingMore(true);
    loadOccurrences(strongs, t, list.items.length, book ?? undefined)
      .then((p) => setPages((cur) => (cur?.key === listKey ? { ...cur, items: [...cur.items, ...p.items] } : cur)))
      .finally(() => setLoadingMore(false));
  }

  const s = scriptProps(detail?.language ?? (strongs[0] === "G" ? "grc" : "hbo"));

  // Group the loaded occurrences by book.
  const groups: { bookId: number; items: Occurrence[] }[] = [];
  for (const o of list?.items ?? []) {
    const b = Math.floor(o.verseId / 1_000_000);
    if (groups.at(-1)?.bookId !== b) groups.push({ bookId: b, items: [] });
    groups.at(-1)!.items.push(o);
  }

  return (
    <SidePanel label={`Concordance for ${detail?.lemma ?? strongs}`}>
      <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4 lg:px-6 lg:pt-6">
        <div className="min-w-0">
          <p className="small-caps text-sm tracking-[0.12em] text-muted">Concordance · {strongs}</p>
          <h2 className="mt-1 flex flex-wrap items-baseline gap-x-3" aria-live="polite">
            <span lang={s.lang} dir={s.dir} className={`${s.className} text-4xl leading-tight`}>
              {detail?.lemma ?? "…"}
            </span>
            {detail?.translit && <span className="font-serif text-lg italic text-muted">{detail.translit}</span>}
          </h2>
          {detail && (
            <p className="mt-1 text-sm">
              <span className="font-serif text-lg">{detail.gloss}</span>
              <span className="text-muted"> · {detail.occurrences.toLocaleString()} occurrences</span>
            </p>
          )}
        </div>
        <PanelClose onClose={onClose} label="Close concordance" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 lg:px-6">
        {lemma?.key === strongs && !detail && <p className="py-6 text-sm text-muted">This word could not be loaded.</p>}
        {detail && (
          <>
            <Distribution byBook={detail.byBook} selected={book} onSelect={setBook} />
            <Link
              href={`/iconograph?lemma=${strongs}${translations.join(",") !== "BSB,KJV" ? `&t=${translations.join(",")}` : ""}`}
              className="mt-2 inline-block text-xs text-muted transition-colors hover:text-accent"
            >
              Cross-references between passages that use this word →
            </Link>

            {detail.siblings.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted">Other senses of {strongs.slice(0, 5)}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {detail.siblings.slice(0, 6).map((sib) => (
                    <button
                      key={sib.strongs}
                      type="button"
                      onClick={() => {
                        setBook(null);
                        onSelectLemma(sib.strongs);
                      }}
                      className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-muted transition-colors hover:border-text/40 hover:text-text"
                    >
                      {sib.gloss ?? sib.strongs} <span className="text-muted">{sib.occurrences}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {detail.definition && (
              <details className="group mt-5 border-t border-rule pt-3">
                <summary className="cursor-pointer list-none text-xs text-muted hover:text-text">
                  <span className="group-open:hidden">Show lexicon entry ▸</span>
                  <span className="hidden group-open:inline">Hide lexicon entry ▾</span>
                </summary>
                <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-line font-serif text-[0.95rem] leading-relaxed text-text/90">
                  {detail.definition}
                </p>
                <p className="mt-2 text-[0.68rem] text-muted">{SOURCE[detail.language]}</p>
              </details>
            )}

            <div className="mt-5 flex items-baseline justify-between border-t border-rule pt-3">
              <p className="text-xs text-muted">
                {book ? (
                  <>
                    In {bookById(book)?.name} · {list?.total ?? "…"}{" "}
                    <button type="button" onClick={() => setBook(null)} className="ml-1 text-accent hover:underline">
                      all books
                    </button>
                  </>
                ) : (
                  <>Every occurrence, in canonical order</>
                )}
              </p>
            </div>

            {!list && <p className="py-4 text-sm text-muted">Loading occurrences…</p>}
            {groups.map((g) => (
              <Fragment key={g.bookId}>
                <h3 className="small-caps mt-5 text-sm tracking-[0.12em] text-muted">{bookById(g.bookId)?.name}</h3>
                <ol className="divide-y divide-rule">
                  {g.items.map((o) => {
                    const ref = decodeVerseId(o.verseId);
                    const b = bookById(ref.book)!;
                    const href = `/read/${b.slug}/${ref.chapter}${readerQuery({ translations, verse: ref.verse, interlinear: true, lemma: strongs })}`;
                    return (
                      <li key={`${o.verseId}-${o.position}`}>
                        <Link href={href} className="group block py-3">
                          <span className="text-xs tracking-wide text-accent group-hover:underline group-hover:underline-offset-4">
                            {formatRange(o.verseId, o.verseId)}
                          </span>
                          <span dir={s.dir} lang={s.lang} className={`${s.className} mt-1 block truncate text-[1.05rem] text-text/70`}>
                            {o.before.length > 0 && "… "}
                            {o.before.join(" ")} <mark className="bg-transparent text-accent">{o.surface}</mark> {o.after.join(" ")}
                            {o.after.length > 0 && " …"}
                          </span>
                          <span className="mt-1 line-clamp-2 block font-serif text-[0.95rem] leading-relaxed text-text/90">
                            {o.text ? <VerseText text={o.text} /> : <em className="text-muted">Not in {t}</em>}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </Fragment>
            ))}
            {list && list.items.length < list.total && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="mt-2 w-full border-t border-rule pt-4 text-sm text-muted transition-colors hover:text-text"
              >
                {loadingMore ? "Loading…" : `Show more (${(list.total - list.items.length).toLocaleString()} remaining)`}
              </button>
            )}
          </>
        )}
      </div>
    </SidePanel>
  );
}
