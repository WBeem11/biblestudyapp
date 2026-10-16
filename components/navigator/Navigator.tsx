"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Snippet } from "@/components/search/Snippet";
import { loadSearch } from "@/lib/search/data";
import type { SearchHit } from "@/lib/search/query";
import { BOOKS, decodeVerseId, formatRange, parseReference, searchBooks, type BookMeta } from "@/lib/refs";

export const OPEN_NAVIGATOR_EVENT = "navigator:open";

type Item =
  | { kind: "ref"; label: string; href: string }
  | { kind: "book"; book: BookMeta }
  | { kind: "chapter"; book: BookMeta; chapter: number }
  | { kind: "hit"; hit: SearchHit }
  | { kind: "all"; query: string; total: number };

/** Keep the reader's translation choice when jumping elsewhere. */
function withTranslations(path: string, verse?: number) {
  const p = new URLSearchParams();
  const t = new URLSearchParams(window.location.search).get("t");
  if (t) p.set("t", t);
  if (verse) p.set("v", String(verse));
  const q = p.toString();
  return q ? `${path}?${q}` : path;
}

export function Navigator() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [book, setBook] = useState<BookMeta | null>(null);
  const [active, setActive] = useState(0);
  const [hits, setHits] = useState<{ q: string; total: number; items: SearchHit[] } | null>(null);

  const open = useCallback(() => {
    const d = dialogRef.current;
    if (!d || d.open) return;
    setQuery("");
    setBook(null);
    setActive(0);
    d.showModal();
    inputRef.current?.focus();
  }, []);

  const close = () => dialogRef.current?.close();

  // ⌘K / Ctrl+K anywhere, "/" when not typing, or the top-bar button's event.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = (e.target as HTMLElement).closest("input, textarea, select, [contenteditable]");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialogRef.current?.open) close();
        else open();
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        open();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_NAVIGATOR_EVENT, open);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_NAVIGATOR_EVENT, open);
    };
  }, [open]);

  // Transient UI: close if this tree is hidden by a navigation (Activity).
  useLayoutEffect(() => () => dialogRef.current?.close(), []);

  // Full-text matches for anything that isn't a reference (debounced).
  const searchable = !book && query.trim().length >= 3 && !parseReference(query.trim()) ? query.trim() : "";
  useEffect(() => {
    if (!searchable) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      const t = (new URLSearchParams(window.location.search).get("t") ?? "BSB").split(",")[0];
      loadSearch(searchable, t, { limit: 5, prefix: true, signal: ctrl.signal })
        .then((r) => setHits({ q: searchable, total: r.total, items: r.items }))
        .catch(() => {});
    }, 160);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [searchable]);
  const currentHits = searchable && hits?.q === searchable ? hits : null;

  const items: Item[] = useMemo(() => {
    if (book) {
      const n = query.trim();
      const chapters = Array.from({ length: book.chapters }, (_, i) => i + 1).filter((c) => !n || String(c).startsWith(n));
      return chapters.map((chapter) => ({ kind: "chapter", book, chapter }));
    }
    const q = query.trim();
    if (!q) return [];
    const out: Item[] = [];
    const ref = parseReference(q);
    if (ref) {
      const b = BOOKS[ref.start.book - 1];
      const verse = ref.start.verse !== 1 || ref.end.verse !== 999 ? ref.start.verse : undefined;
      out.push({
        kind: "ref",
        label: `${b.refName} ${ref.start.chapter}${verse ? `:${verse}` : ""}`,
        href: withTranslations(`/read/${b.slug}/${ref.start.chapter}`, verse),
      });
    }
    for (const b of searchBooks(q).slice(0, ref ? 3 : 4)) out.push({ kind: "book", book: b });
    for (const hit of currentHits?.items ?? []) out.push({ kind: "hit", hit });
    if (currentHits && currentHits.total > 0) out.push({ kind: "all", query: currentHits.q, total: currentHits.total });
    return out;
  }, [query, book, currentHits]);

  const activeIndex = Math.min(active, Math.max(items.length - 1, 0));

  function go(href: string) {
    close();
    router.push(href);
  }

  function choose(item: Item | undefined) {
    if (!item) return;
    if (item.kind === "ref") go(item.href);
    else if (item.kind === "hit") {
      const r = decodeVerseId(item.hit.verseId);
      go(withTranslations(`/read/${BOOKS[r.book - 1].slug}/${r.chapter}`, r.verse));
    } else if (item.kind === "all") {
      const t = new URLSearchParams(window.location.search).get("t");
      go(`/search?q=${encodeURIComponent(item.query)}${t ? `&t=${t}` : ""}`);
    }
    else if (item.kind === "chapter") go(withTranslations(`/read/${item.book.slug}/${item.chapter}`));
    else if (item.book.chapters === 1) go(withTranslations(`/read/${item.book.slug}/1`));
    else {
      setBook(item.book);
      setQuery("");
      setActive(0);
      inputRef.current?.focus();
    }
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    const step = book ? { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 } : { ArrowUp: -1, ArrowDown: 1 };
    const delta = (step as Record<string, number>)[e.key];
    if (delta !== undefined && items.length) {
      e.preventDefault();
      setActive(Math.max(0, Math.min(items.length - 1, activeIndex + delta)));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(items[activeIndex]);
    } else if (e.key === "Backspace" && book && !query) {
      e.preventDefault();
      setBook(null);
    }
  }

  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Go to passage"
      onClick={(e) => {
        if (e.target === dialogRef.current) close(); // backdrop click
      }}
      className="m-auto mt-[12vh] w-[min(40rem,calc(100vw-2rem))] rounded-lg border border-rule bg-ground p-0 text-text backdrop:bg-black/25 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-center gap-3 border-b border-rule px-5">
        {book && (
          <button
            type="button"
            onClick={() => {
              setBook(null);
              inputRef.current?.focus();
            }}
            className="shrink-0 rounded-full border border-rule px-3 py-1 text-xs tracking-wide text-muted hover:text-text"
            aria-label={`${book.name}, back to books`}
          >
            {book.name} ×
          </button>
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onInputKey}
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls={listId}
          aria-activedescendant={items.length ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          placeholder={book ? "Chapter" : "Go to Rom 8:28, or search words"}
          inputMode={book ? "numeric" : "text"}
          className="h-14 min-w-0 flex-1 bg-transparent font-serif text-xl outline-none placeholder:text-muted"
          spellCheck={false}
          autoComplete="off"
        />
        <kbd className="hidden sm:inline">esc</kbd>
      </div>

      <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-3">
        {book ? (
          <ul id={listId} role="listbox" aria-label={`${book.name} chapters`} className="grid grid-cols-8 gap-1">
            {items.map((item, i) =>
              item.kind === "chapter" ? (
                <li
                  key={item.chapter}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => choose(item)}
                  onMouseMove={() => setActive(i)}
                  className={`cursor-pointer rounded py-2.5 text-center font-serif text-lg ${i === activeIndex ? "bg-surface text-accent" : "text-text"}`}
                >
                  {item.chapter}
                </li>
              ) : null,
            )}
          </ul>
        ) : items.length ? (
          <ul id={listId} role="listbox" aria-label="Results">
            {items.map((item, i) => (
              <li
                key={item.kind === "ref" ? item.href : item.kind === "book" ? item.book.osis : item.kind === "hit" ? item.hit.verseId : `${item.kind}-${i}`}
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => choose(item)}
                onMouseMove={() => setActive(i)}
                className={`flex cursor-pointer items-baseline justify-between rounded px-3 py-2.5 ${i === activeIndex ? "bg-surface" : ""}`}
              >
                {item.kind === "hit" ? (
                  <span className="min-w-0">
                    <span className="block text-xs tracking-wide text-accent">{formatRange(item.hit.verseId, item.hit.verseId)}</span>
                    <span className="line-clamp-2 block font-serif text-[0.95rem] leading-snug">
                      <Snippet text={item.hit.snippet} />
                    </span>
                  </span>
                ) : (
                  <span className={`font-serif ${item.kind === "all" ? "text-base text-muted" : "text-lg"}`}>
                    {item.kind === "ref"
                      ? `Go to ${item.label}`
                      : item.kind === "book"
                        ? item.book.name
                        : item.kind === "all"
                          ? `See all ${item.total.toLocaleString()} verses with “${item.query}”`
                          : ""}
                  </span>
                )}
                <span className="shrink-0 pl-3 text-xs text-muted">
                  {item.kind === "book" ? `${item.book.chapters} ${item.book.chapters === 1 ? "chapter" : "chapters"}` : item.kind === "hit" ? "" : "↵"}
                </span>
              </li>
            ))}
          </ul>
        ) : query.trim() ? (
          <p className="px-3 py-6 text-sm text-muted">No book or reference matches “{query.trim()}”.</p>
        ) : (
          <div id={listId} className="grid gap-6 px-2 py-2 sm:grid-cols-2">
            {(["OT", "NT"] as const).map((t) => (
              <section key={t} aria-label={t === "OT" ? "Old Testament" : "New Testament"}>
                <h3 className="small-caps mb-2 text-sm tracking-[0.12em] text-muted">
                  {t === "OT" ? "Old Testament" : "New Testament"}
                </h3>
                <ul className="grid grid-cols-2 gap-x-3">
                  {BOOKS.filter((b) => b.testament === t).map((b) => (
                    <li key={b.osis}>
                      <button
                        type="button"
                        onClick={() => choose({ kind: "book", book: b })}
                        className="w-full truncate rounded px-1.5 py-1 text-left font-serif text-[0.95rem] hover:bg-surface"
                      >
                        {b.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
