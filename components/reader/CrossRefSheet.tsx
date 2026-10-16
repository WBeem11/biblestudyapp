"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStudyData } from "@/lib/api";
import type { CrossRefPreview } from "@/lib/queries/crossrefs";
import { readerQuery, type TranslationId } from "@/lib/reader/state";
import { bookById, decodeVerseId, formatRange } from "@/lib/refs";
import { PanelClose, SidePanel } from "./SidePanel";
import { VerseText } from "./VerseText";

interface Data {
  total: number;
  refs: CrossRefPreview[];
}

const INITIAL = 20;
// Session cache: the data is static, so a verse revisited shows instantly.
const cache = new Map<string, Data>();

interface Props {
  verseId: number;
  label: string;
  translation: TranslationId; // preview text shown in the primary translation
  translations: TranslationId[]; // preserved on links
  interlinear?: boolean; // preserved on links
  threads?: boolean; // preserved on links
  onClose: () => void;
}

export function CrossRefSheet({ verseId, label, translation, translations, interlinear, threads, onClose }: Props) {
  const key = `${verseId}:${translation}`;
  const [loaded, setLoaded] = useState<{ key: string; data: Data } | { key: string; error: true } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const cached = cache.get(key);
  const data = cached ?? (loaded && loaded.key === key && "data" in loaded ? loaded.data : null);
  const failed = !data && loaded?.key === key && "error" in loaded;

  useEffect(() => {
    if (cache.has(key)) return;
    const ctrl = new AbortController();
    getStudyData<Data>(`/api/crossrefs/${verseId}?t=${translation}&limit=500`, { signal: ctrl.signal })
      .then((d) => {
        cache.set(key, d);
        setLoaded({ key, data: d });
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) {
          console.error(e);
          setLoaded({ key, error: true });
        }
      });
    return () => ctrl.abort();
  }, [key, verseId, translation]);

  const refs = data ? (showAll ? data.refs : data.refs.slice(0, INITIAL)) : [];
  const maxVotes = Math.max(1, ...(data?.refs.map((r) => r.votes) ?? [1]));

  return (
    <SidePanel label={`Cross-references for ${label}`}>
      <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4 lg:px-6 lg:pt-6">
        <div>
          <p className="small-caps text-sm tracking-[0.12em] text-muted">Cross-references</p>
          <h2 className="mt-1 font-serif text-2xl" aria-live="polite">
            {label}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {data ? `${data.total} passages · ranked by OpenBible.info votes` : failed ? " " : "Loading…"}
          </p>
        </div>
        <PanelClose onClose={onClose} label="Close cross-references" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 lg:px-6">
        {failed && <p className="py-6 text-sm text-muted">Cross-references could not be loaded.</p>}
        {!data && !failed && (
          <ul aria-hidden className="space-y-6 py-4">
            {[0, 1, 2].map((i) => (
              <li key={i} className="space-y-2">
                <div className="h-3 w-24 rounded bg-surface" />
                <div className="h-3 w-full rounded bg-surface" />
                <div className="h-3 w-4/5 rounded bg-surface" />
              </li>
            ))}
          </ul>
        )}
        {data && data.refs.length === 0 && (
          <p className="py-6 text-sm text-muted">No cross-references for this verse.</p>
        )}
        {data && data.refs.length > 0 && (
          <ol className="divide-y divide-rule">
            {refs.map((r) => {
              const to = decodeVerseId(r.toStart);
              const book = bookById(to.book)!;
              const href = `/read/${book.slug}/${to.chapter}${readerQuery({ translations, verse: to.verse, interlinear, threads })}`;
              return (
                <li key={`${r.toStart}-${r.toEnd}`}>
                  <Link href={href} className="group block py-4">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-sm tracking-wide text-accent group-hover:underline group-hover:underline-offset-4">
                        {formatRange(r.toStart, r.toEnd)}
                      </span>
                      <span
                        className="h-px shrink-0 bg-gilt"
                        style={{ width: `${Math.max(4, (Math.max(r.votes, 0) / maxVotes) * 48)}px` }}
                        role="img"
                        aria-label={`${r.votes} votes`}
                        title={`${r.votes} votes`}
                      />
                    </span>
                    {r.text ? (
                      <span className="mt-1.5 line-clamp-3 block font-serif text-[1.0625rem] leading-relaxed text-text/90">
                        <VerseText text={r.text} />
                        {r.truncated && " …"}
                      </span>
                    ) : (
                      <span className="mt-1.5 block text-sm italic text-muted">Not in {translation}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
        {data && !showAll && data.refs.length > INITIAL && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-2 w-full border-t border-rule pt-4 text-sm text-muted transition-colors hover:text-text"
          >
            Show all {data.refs.length}
          </button>
        )}
      </div>
    </SidePanel>
  );
}
