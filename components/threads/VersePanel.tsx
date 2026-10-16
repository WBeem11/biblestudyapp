"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { VerseText } from "@/components/reader/VerseText";
import { readerQuery, type TranslationId } from "@/lib/reader/state";
import { BOOKS, decodeVerseId, formatRange, type Genre } from "@/lib/refs";
import { GENRES, GENRE_NAME, genreOfVerse, genreVar } from "@/lib/threads/genres";
import { loadVerseRefs } from "@/lib/threads/data";
import type { VerseReference } from "@/lib/threads/types";

interface Props {
  verseId: number;
  label: string; // "Acts 1:1"
  context: string; // "Acts · New Testament"
  genre: Genre;
  text: string | undefined;
  translations: TranslationId[];
  iconographHref: string;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
}

type Order = "canonical" | "strongest";

/** Where one verse points: a genre breakdown and every reference, read in full in place. */
export function VersePanel({ verseId, label, context, genre, text, translations, iconographHref, onPrev, onNext, onClose }: Props) {
  const t = translations[0];
  const key = `${verseId}:${t}`;
  const [data, setData] = useState<{ key: string; refs: VerseReference[] } | null>(null);
  const [order, setOrder] = useState<Order>("canonical");
  const refs = data?.key === key ? data.refs : null;

  useEffect(() => {
    let live = true;
    loadVerseRefs(verseId, t).then((d) => live && setData({ key, refs: d.refs }));
    return () => {
      live = false;
    };
  }, [verseId, t, key]);

  const byGenre = new Map<Genre, number>();
  for (const r of refs ?? []) byGenre.set(genreOfVerse(r.toStart), (byGenre.get(genreOfVerse(r.toStart)) ?? 0) + 1);
  const present = GENRES.filter((g) => byGenre.has(g));

  // Canonical: grouped by book. Strongest: one list by votes.
  const groups: { bookId: number; refs: VerseReference[] }[] = [];
  if (refs && order === "canonical") {
    for (const r of refs) {
      const b = Math.floor(r.toStart / 1_000_000);
      if (groups.at(-1)?.bookId !== b) groups.push({ bookId: b, refs: [] });
      groups.at(-1)!.refs.push(r);
    }
  }
  const strongest = refs && order === "strongest" ? [...refs].sort((a, b) => b.votes - a.votes) : [];

  const hrefFor = (r: VerseReference) => {
    const d = decodeVerseId(r.toStart);
    return `/read/${BOOKS[d.book - 1].slug}/${d.chapter}${readerQuery({ translations, verse: d.verse, threads: true })}`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs text-muted">
            <span aria-hidden className="h-[3px] w-3 rounded-full" style={{ background: genreVar(genre) }} />
            {context}
          </p>
          <div className="flex gap-1">
            {[
              { fn: onPrev, label: "Previous verse", glyph: "‹" },
              { fn: onNext, label: "Next verse", glyph: "›" },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={b.fn ?? undefined}
                disabled={!b.fn}
                aria-label={b.label}
                className="grid h-7 w-7 place-items-center rounded-md border border-rule text-base leading-none text-muted transition-colors hover:text-text disabled:opacity-40"
              >
                {b.glyph}
              </button>
            ))}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close verse"
              className="grid h-7 w-7 place-items-center rounded-md border border-rule text-base leading-none text-muted transition-colors hover:text-text"
            >
              ×
            </button>
          </div>
        </div>
        <h2 className="mt-1 font-serif text-2xl" aria-live="polite">
          {label}
        </h2>
        {text && (
          <p className="mt-3 font-serif text-[1.0625rem] leading-relaxed">
            <VerseText text={text} />
          </p>
        )}
        <Link
          href={iconographHref}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-rule px-3 py-1.5 text-xs text-text transition-colors hover:border-text/40"
        >
          <svg aria-hidden viewBox="0 0 16 10" className="h-2.5 w-4 fill-none stroke-current" strokeWidth={1.4}>
            <path d="M1 9a7 7 0 0 1 14 0M4 9a4 4 0 0 1 8 0" />
          </svg>
          Show in Iconograph
        </Link>

        {/* Connects to: genre breakdown */}
        <div className="mt-4 rounded-md border border-rule px-3 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-[0.68rem] tracking-[0.14em] text-muted">CONNECTS TO</span>
            <div className="flex h-1.5 min-w-0 flex-1 gap-[2px]" role="img" aria-label={present.map((g) => `${GENRE_NAME[g]} ${byGenre.get(g)}`).join(", ")}>
              {refs &&
                present.map((g) => (
                  <span key={g} className="h-full rounded-full first:rounded-l-full" style={{ flex: byGenre.get(g), background: genreVar(g) }} />
                ))}
            </div>
            <span className="font-serif text-lg tabular-nums">{refs?.length ?? "…"}</span>
            <label className="sr-only" htmlFor="ref-order">
              Order references
            </label>
            <select
              id="ref-order"
              value={order}
              onChange={(e) => setOrder(e.target.value as Order)}
              className="rounded border border-rule bg-ground px-1 py-0.5 text-xs text-muted"
            >
              <option value="canonical">Canonical</option>
              <option value="strongest">Strongest</option>
            </select>
          </div>
          {present.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] text-muted" aria-label="Legend">
              {present.map((g) => (
                <li key={g} className="flex items-center gap-1.5">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: genreVar(g) }} />
                  {GENRE_NAME[g]} <span className="tabular-nums">{byGenre.get(g)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 flex items-center gap-2 border-b border-rule pb-2 text-[0.68rem] tracking-[0.14em] text-muted">
          <span aria-hidden>→</span> REFERENCES <span className="tracking-normal">· where this passage points</span>
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        {!refs && <p className="py-4 text-sm text-muted">Loading…</p>}
        {refs?.length === 0 && <p className="py-4 text-sm text-muted">No cross-references for this verse.</p>}
        {groups.map((g) => (
          <Fragment key={g.bookId}>
            <h3 className="mt-4 flex items-center gap-2 text-xs font-semibold">
              <span aria-hidden className="h-[3px] w-3 rounded-full" style={{ background: genreVar(BOOKS[g.bookId - 1].genre) }} />
              {BOOKS[g.bookId - 1].name}
              <span className="font-normal text-muted">{g.refs.length}</span>
            </h3>
            <ol>
              {g.refs.map((r) => (
                <Reference key={`${r.toStart}-${r.toEnd}`} r={r} href={hrefFor(r)} />
              ))}
            </ol>
          </Fragment>
        ))}
        {strongest.length > 0 && (
          <ol className="mt-2">
            {strongest.map((r) => (
              <Reference key={`${r.toStart}-${r.toEnd}`} r={r} href={hrefFor(r)} showVotes />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Reference({ r, href, showVotes }: { r: VerseReference; href: string; showVotes?: boolean }) {
  const range = r.toEnd > r.toStart;
  return (
    <li className="mt-2.5">
      <Link href={href} className="group block">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium group-hover:text-accent group-hover:underline group-hover:underline-offset-4">
            {formatRange(r.toStart, r.toEnd)}
          </span>
          {showVotes && <span className="text-[0.7rem] text-muted">{r.votes} votes</span>}
        </span>
        <span className="mt-0.5 block font-serif text-[0.98rem] leading-relaxed text-text/90">
          {r.verses.map((v) => (
            <Fragment key={v.id}>
              {range && <sup className="mr-0.5 text-[0.65em] text-muted">{v.id % 1000}</sup>}
              <VerseText text={v.text} />{" "}
            </Fragment>
          ))}
          {r.truncated && "…"}
          {r.verses.length === 0 && <em className="text-muted">Not in this translation</em>}
        </span>
      </Link>
    </li>
  );
}
