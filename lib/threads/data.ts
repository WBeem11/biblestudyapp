"use client";

import { getStudyData } from "@/lib/api";
import type { ChapterThreads, VerseReference } from "./types";

const cache = new Map<string, Promise<ChapterThreads>>();

export function loadThreads(bookId: number, chapter: number): Promise<ChapterThreads> {
  const key = `${bookId}:${chapter}`;
  let p = cache.get(key);
  if (!p) {
    p = getStudyData<ChapterThreads>(`/api/threads/${bookId}/${chapter}`);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

const refCache = new Map<string, Promise<{ refs: VerseReference[] }>>();

export function loadVerseRefs(verseId: number, t: string): Promise<{ refs: VerseReference[] }> {
  const key = `${verseId}:${t}`;
  let p = refCache.get(key);
  if (!p) {
    p = getStudyData<{ refs: VerseReference[] }>(`/api/verse-refs/${verseId}?t=${t}`);
    p.catch(() => refCache.delete(key));
    refCache.set(key, p);
    if (refCache.size > 80) refCache.delete(refCache.keys().next().value!);
  }
  return p;
}
