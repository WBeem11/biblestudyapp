"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { scriptProps } from "@/components/concordance/script";
import { GENRE_NAME, genreVar } from "@/lib/threads/genres";
import { loadLemma } from "@/lib/concordance/data";
import type { LemmaDetail } from "@/lib/concordance/types";
import { GENRES, type ArcFilters, type TestamentFilter } from "@/lib/iconograph/model";
import { iconographQuery, parseIconographState, type IconographState } from "@/lib/iconograph/state";
import { parseReaderState, readerQuery } from "@/lib/reader/state";
import { findBook } from "@/lib/refs";
import { ArcCanvas, type ArcStats } from "./ArcCanvas";

const TESTAMENT_OPTIONS: { id: TestamentFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bridges", label: "Between Testaments" },
  { id: "ot", label: "Within OT" },
  { id: "nt", label: "Within NT" },
];

const GENRE_LABEL: Record<string, string> = {
  law: "Law",
  history: "History",
  wisdom: "Wisdom & Poetry",
  prophets: "Prophets",
  gospels: "Gospels",
  acts: "Acts",
  epistles: "Epistles",
  apocalyptic: "Apocalyptic",
};

export function IconographView() {
  const params = useSearchParams();
  const state = useMemo(() => parseIconographState(params), [params]);
  const translations = useMemo(() => parseReaderState(params, 0).translations, [params]);
  const [stats, setStats] = useState<(ArcStats & { highlighted: number }) | null>(null);
  const [lemma, setLemma] = useState<LemmaDetail | null>(null);
  useEffect(() => {
    if (!state.lemma) return;
    let live = true;
    loadLemma(state.lemma).then((d) => live && setLemma(d)).catch(console.error);
    return () => {
      live = false;
    };
  }, [state.lemma]);
  const lemmaDetail = state.lemma && lemma?.strongs === state.lemma ? lemma : null;
  const lemmaChapters = useMemo(() => (lemmaDetail ? new Set(lemmaDetail.chapters) : null), [lemmaDetail]);
  // The slider updates locally while dragging and commits to the URL on release.
  const [pctDraft, setPctDraft] = useState<number | null>(null);
  const pct = pctDraft ?? state.filters.strongestPct;
  const filters: ArcFilters = useMemo(() => ({ ...state.filters, strongestPct: pct }), [state.filters, pct]);

  const update = useCallback(
    (patch: { focus?: IconographState["focus"]; lemma?: string | null; filters?: Partial<ArcFilters> }) => {
      const next = { ...state, ...patch, filters: { ...state.filters, ...patch.filters } };
      window.history.replaceState(null, "", window.location.pathname + iconographQuery(next, new URLSearchParams(window.location.search)));
    },
    [state],
  );

  const focusLabel = state.focus ? focusTitle(state.focus.slug, state.focus.chapter) : null;

  return (
    <>
      <div className="flex justify-end">
        <dl className="-mt-16 flex gap-8 text-sm max-sm:mt-4 max-sm:justify-start" aria-live="polite">
          <div>
            <dt className="text-xs text-muted">Showing</dt>
            <dd className="font-serif text-xl tabular-nums">
              {stats ? stats.shown.toLocaleString() : "—"}
              <span className="text-sm text-muted"> / {stats ? stats.total.toLocaleString() : "—"}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Detail</dt>
            <dd className="font-serif text-xl">{stats?.level === "verse" ? "Verses" : "Chapters"}{stats?.loading ? "…" : ""}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-rule py-3 text-sm">
        <div role="group" aria-label="Testament" className="flex flex-wrap gap-1">
          {TESTAMENT_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={state.filters.testament === o.id}
              onClick={() => update({ filters: { testament: o.id } })}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${state.filters.testament === o.id ? "border-text/70 text-text" : "border-rule text-muted hover:text-text"}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-muted">
          Touching
          <select
            value={state.filters.genre}
            onChange={(e) => update({ filters: { genre: e.target.value as ArcFilters["genre"] } })}
            className="rounded-full border border-rule bg-ground px-3 py-1 text-xs text-text"
          >
            <option value="all">Any genre</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {GENRE_LABEL[g]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-3 text-xs text-muted">
          Strongest
          <input
            type="range"
            min={1}
            max={100}
            value={pct}
            onChange={(e) => setPctDraft(Number(e.target.value))}
            onPointerUp={() => {
              if (pctDraft !== null) update({ filters: { strongestPct: pctDraft } });
              setPctDraft(null);
            }}
            onKeyUp={() => {
              if (pctDraft !== null) update({ filters: { strongestPct: pctDraft } });
              setPctDraft(null);
            }}
            className="w-32 accent-[var(--accent)]"
            aria-valuetext={`${pct} percent`}
          />
          <span className="w-9 tabular-nums text-text">{pct}%</span>
        </label>

        {focusLabel && state.focus && (
          <span className="flex items-center gap-2 rounded-full border border-accent/60 py-0.5 pl-3 pr-1 text-xs">
            <Link
              href={`/read/${state.focus.slug}/${state.focus.chapter}${readerQuery({ translations })}`}
              className="text-accent hover:underline"
            >
              {focusLabel}
            </Link>
            <button
              type="button"
              onClick={() => update({ focus: null })}
              aria-label={`Stop highlighting ${focusLabel}`}
              className="rounded-full px-1.5 text-muted hover:text-text"
            >
              ×
            </button>
          </span>
        )}

        {state.lemma && (
          <span className="flex items-center gap-2 rounded-full border border-accent/60 py-0.5 pl-3 pr-1 text-xs">
            <span className="text-muted">Both ends use</span>
            {lemmaDetail ? (
              <span lang={scriptProps(lemmaDetail.language).lang} className={`${scriptProps(lemmaDetail.language).className} text-sm text-accent`}>
                {lemmaDetail.lemma}
              </span>
            ) : (
              <span className="text-accent">{state.lemma}</span>
            )}
            {lemmaDetail?.gloss && <span className="text-muted">“{lemmaDetail.gloss}”</span>}
            {stats && lemmaDetail && <span className="tabular-nums text-muted">· {stats.highlighted.toLocaleString()} arcs</span>}
            <button
              type="button"
              onClick={() => update({ lemma: null })}
              aria-label="Stop highlighting this word"
              className="rounded-full px-1.5 text-muted hover:text-text"
            >
              ×
            </button>
          </span>
        )}

        <ul className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend: arcs are colored by the genre they start from">
          {GENRES.map((g, i) => (
            <li key={g} className={`flex items-center gap-1.5 ${i === 4 ? "sm:ml-2" : ""}`}>
              <span aria-hidden className="h-[3px] w-4 rounded-full" style={{ background: genreVar(g) }} />
              {GENRE_NAME[g]}
            </li>
          ))}
        </ul>
      </div>

      <ArcCanvas
        variant="full"
        filters={filters}
        focusChapter={state.focus?.ordinal ?? null}
        lemmaChapters={lemmaChapters}
        translations={translations}
        onStats={setStats}
        className="mt-2 h-[min(60dvh,calc(50vw+5rem))] min-h-[14rem] outline-none md:h-auto md:flex-1"
      />
      <p className="hidden pt-2 text-center text-xs text-muted md:block">
        Scroll or pinch to zoom · drag to pan · <kbd>+</kbd> <kbd>−</kbd> <kbd>←</kbd> <kbd>→</kbd> <kbd>0</kbd> · hover the axis
        for a chapter · click to read
      </p>
    </>
  );
}

function focusTitle(slug: string, chapter: number) {
  return `${findBook(slug)?.refName ?? slug} ${chapter}`;
}
