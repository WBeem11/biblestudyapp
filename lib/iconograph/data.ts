"use client";

import { getStudyBinary, getStudyData } from "@/lib/api";
import { decodeOverview, decodeVerseEdges, type OverviewData, type VerseEdges } from "./format";

let overviewPromise: Promise<OverviewData> | null = null;

/** The overview payload, fetched once per session. */
export function loadOverview(): Promise<OverviewData> {
  overviewPromise ??= getStudyBinary("/api/iconograph/overview")
    .then(decodeOverview)
    .catch((e) => {
      overviewPromise = null;
      throw e;
    });
  return overviewPromise;
}

const edgeCache = new Map<string, Promise<VerseEdges>>();

export function loadVerseEdges(lo: number, hi: number, signal?: AbortSignal): Promise<VerseEdges> {
  const key = `${lo}-${hi}`;
  let p = edgeCache.get(key);
  if (!p) {
    p = getStudyBinary(`/api/iconograph/edges?lo=${lo}&hi=${hi}&min=0`, { signal }).then(decodeVerseEdges);
    p.catch(() => edgeCache.delete(key));
    edgeCache.set(key, p);
    if (edgeCache.size > 12) edgeCache.delete(edgeCache.keys().next().value!);
  }
  return p;
}

export interface Passage {
  start: number;
  end: number;
  text: string;
  truncated: boolean;
}

export interface PairRef {
  from: number;
  toStart: number;
  toEnd: number;
  votes: number;
  fromText: string;
  to: Passage;
}

const textCache = new Map<string, Promise<unknown>>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = textCache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load();
    p.catch(() => textCache.delete(key));
    textCache.set(key, p);
  }
  return p;
}

export function loadChapterPair(a: number, b: number, t: string) {
  return cached(`pair:${a}:${b}:${t}`, () => getStudyData<{ pairs: PairRef[] }>(`/api/iconograph/pair/${a}/${b}?t=${t}`));
}

export function loadPassages(ranges: [number, number][], t: string) {
  const r = ranges.map(([s, e]) => (s === e ? `${s}` : `${s}-${e}`)).join(",");
  return cached(`p:${r}:${t}`, () => getStudyData<{ passages: Passage[] }>(`/api/passages?r=${r}&t=${t}`));
}

export function loadSharedLemmas(a: [number, number], b: [number, number]) {
  const r = ([s, e]: [number, number]) => (s === e ? `${s}` : `${s}-${Math.min(e, s + 7)}`);
  return cached(`shared:${r(a)}:${r(b)}`, () =>
    getStudyData<{ shared: import("@/lib/concordance/types").SharedLemma[] }>(`/api/shared-lemmas?a=${r(a)}&b=${r(b)}`),
  );
}
