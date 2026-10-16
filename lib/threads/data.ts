"use client";

import { getStudyData } from "@/lib/api";
import type { ChapterThreads } from "./types";

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
