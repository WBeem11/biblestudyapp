"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { VerseText } from "@/components/reader/VerseText";
import { loadPassages, type Passage } from "@/lib/iconograph/data";
import { readerQuery, type ReaderState } from "@/lib/reader/state";
import { bookById, decodeVerseId, formatRange } from "@/lib/refs";
import type { ThreadRef } from "@/lib/threads/types";

/** Passages pinned from a verse's thread rail, read in place beneath the verse. */
export function PinnedPassages({
  refs,
  state,
  onUnpin,
}: {
  refs: ThreadRef[];
  state: ReaderState;
  onUnpin: (ref: ThreadRef) => void;
}) {
  return (
    <ul className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
      {refs.map((r) => (
        <PinnedPassage key={`${r[1]}-${r[2]}`} r={r} state={state} onUnpin={() => onUnpin(r)} />
      ))}
    </ul>
  );
}

function PinnedPassage({ r, state, onUnpin }: { r: ThreadRef; state: ReaderState; onUnpin: () => void }) {
  const [, s, e, votes] = r;
  const t = state.translations[0];
  const [p, setP] = useState<{ key: string; passage: Passage } | null>(null);
  const key = `${s}-${e}:${t}`;
  useEffect(() => {
    let live = true;
    loadPassages([[s, e]], t).then((d) => live && setP({ key, passage: d.passages[0] }));
    return () => {
      live = false;
    };
  }, [s, e, t, key]);
  const ref = decodeVerseId(s);
  const b = bookById(ref.book)!;
  const href = `/read/${b.slug}/${ref.chapter}${readerQuery({ ...state, verse: ref.verse, lemma: null })}`;
  const passage = p?.key === key ? p.passage : null;

  return (
    <li className="rounded-md border-l-2 border-gilt bg-surface/60 py-2 pl-3 pr-2">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <Link href={href} className="tracking-wide text-accent hover:underline">
          {formatRange(s, e)} →
        </Link>
        <span className="flex items-center gap-2 text-muted">
          {votes} votes
          <button type="button" onClick={onUnpin} aria-label={`Unpin ${formatRange(s, e)}`} className="rounded px-1 text-base leading-none hover:text-text">
            ×
          </button>
        </span>
      </div>
      <p className="mt-1 font-serif text-[1.0625rem] leading-relaxed">
        {passage ? <VerseText text={passage.text} /> : <span className="text-muted">…</span>}
        {passage?.truncated && " …"}
      </p>
    </li>
  );
}
