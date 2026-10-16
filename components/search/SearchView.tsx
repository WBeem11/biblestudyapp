"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Distribution } from "@/components/concordance/Distribution";
import { parseReaderState, readerQuery } from "@/lib/reader/state";
import { loadSearch } from "@/lib/search/data";
import type { SearchHit } from "@/lib/search/query";
import { BOOKS, bookById, decodeVerseId, formatRange, parseReference } from "@/lib/refs";
import { Snippet } from "./Snippet";

export function SearchView() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const translations = useMemo(() => parseReaderState(params, 0).translations, [params]);
  const t = translations[0];
  const [draft, setDraft] = useState(q);
  const [book, setBook] = useState<number | null>(null);
  const [res, setRes] = useState<{ key: string; total: number; items: SearchHit[]; byBook: number[] } | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const key = `${q}:${t}:${book ?? ""}`;
  const current = res?.key === key ? res : null;
  const error = errorKey === key;
  const ref = parseReference(q);

  useEffect(() => {
    if (!q.trim()) return;
    const ctrl = new AbortController();
    loadSearch(q, t, { book: book ?? undefined, signal: ctrl.signal })
      .then((r) =>
        setRes((prev) => ({
          key,
          total: r.total,
          items: r.items,
          // Keep the whole-Bible distribution when filtering to a book.
          byBook: book && prev?.byBook ? prev.byBook : (r.byBook ?? new Array(66).fill(0)),
        })),
      )
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        console.error(e);
        setErrorKey(key);
      });
    return () => ctrl.abort();
  }, [q, t, book, key]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setBook(null);
    const p = new URLSearchParams(params.toString());
    p.set("q", draft.trim());
    router.replace(`/search?${p}`);
  }

  function loadMore() {
    if (!current) return;
    loadSearch(q, t, { offset: current.items.length, book: book ?? undefined }).then((r) =>
      setRes((prev) => (prev?.key === key ? { ...prev, items: [...prev.items, ...r.items] } : prev)),
    );
  }

  const groups: { bookId: number; items: SearchHit[] }[] = [];
  for (const h of current?.items ?? []) {
    const b = Math.floor(h.verseId / 1_000_000);
    if (groups.at(-1)?.bookId !== b) groups.push({ bookId: b, items: [] });
    groups.at(-1)!.items.push(h);
  }

  return (
    // min-height matches the Suspense fallback and keeps the footer below the fold while results load.
    <div className="mx-auto min-h-[85vh] w-full max-w-3xl px-5 pb-24 pt-12 sm:px-8">
      <form role="search" onSubmit={submit} className="flex items-center gap-3 border-b border-rule pb-3">
        <label htmlFor="search-q" className="sr-only">
          Search the Bible
        </label>
        <input
          id="search-q"
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='Words or "a phrase"'
          className="min-w-0 flex-1 bg-transparent font-serif text-3xl outline-none placeholder:text-muted"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="text-xs tracking-[0.14em] text-muted">{t}</span>
      </form>

      {ref && (
        <p className="mt-6 text-sm">
          <Link
            href={`/read/${BOOKS[ref.start.book - 1].slug}/${ref.start.chapter}${readerQuery({ translations, verse: ref.end.verse === 999 ? null : ref.start.verse })}`}
            className="text-accent hover:underline"
          >
            Go to {BOOKS[ref.start.book - 1].refName} {ref.start.chapter}
            {ref.end.verse !== 999 ? `:${ref.start.verse}` : ""} →
          </Link>
        </p>
      )}

      {!q.trim() && <p className="mt-10 text-muted">Search every verse of the {t} for words or an exact “phrase”.</p>}
      {error && <p className="mt-10 text-muted">Search failed. Please try again.</p>}

      {current && (
        <>
          <div className="mt-8" aria-live="polite">
            <p className="text-sm text-muted">
              {book ? (
                <>
                  {current.total.toLocaleString()} in {bookById(book)?.name} ·{" "}
                  <button type="button" onClick={() => setBook(null)} className="text-accent hover:underline">
                    all books
                  </button>
                </>
              ) : (
                <>
                  {current.total.toLocaleString()} verse{current.total === 1 ? "" : "s"} in the {t}
                </>
              )}
            </p>
            {current.total > 0 && (
              <div className="mt-3">
                <Distribution byBook={current.byBook} selected={book} onSelect={setBook} />
              </div>
            )}
          </div>

          {groups.map((g) => (
            <Fragment key={g.bookId}>
              <h2 className="small-caps mt-8 text-sm tracking-[0.12em] text-muted">{bookById(g.bookId)?.name}</h2>
              <ol className="divide-y divide-rule">
                {g.items.map((h) => {
                  const r = decodeVerseId(h.verseId);
                  const b = bookById(r.book)!;
                  return (
                    <li key={h.verseId}>
                      <Link href={`/read/${b.slug}/${r.chapter}${readerQuery({ translations, verse: r.verse })}`} className="group block py-3">
                        <span className="text-xs tracking-wide text-accent group-hover:underline">{formatRange(h.verseId, h.verseId)}</span>
                        <span className="mt-1 block font-serif text-[1.0625rem] leading-relaxed">
                          <Snippet text={h.snippet} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </Fragment>
          ))}

          {current.items.length < current.total && (
            <button type="button" onClick={loadMore} className="mt-4 w-full border-t border-rule pt-4 text-sm text-muted hover:text-text">
              Show more ({(current.total - current.items.length).toLocaleString()} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}
