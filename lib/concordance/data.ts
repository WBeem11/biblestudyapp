"use client";

import { getStudyData } from "@/lib/api";
import type { InterlinearChapter, LemmaDetail, OccurrencePage } from "./types";

const cache = new Map<string, Promise<unknown>>();

function cached<T>(key: string, path: string): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = getStudyData<T>(path);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export const loadInterlinear = (bookId: number, chapter: number) =>
  cached<InterlinearChapter>(`il:${bookId}:${chapter}`, `/api/interlinear/${bookId}/${chapter}`);

export const loadLemma = (strongs: string) => cached<LemmaDetail>(`lemma:${strongs}`, `/api/lemmas/${strongs}`);

export const loadOccurrences = (strongs: string, t: string, offset: number, book?: number) =>
  cached<OccurrencePage>(
    `occ:${strongs}:${t}:${offset}:${book ?? ""}`,
    `/api/lemmas/${strongs}/occurrences?t=${t}&offset=${offset}&limit=60${book ? `&book=${book}` : ""}`,
  );
