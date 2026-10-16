"use client";

import { getStudyData } from "@/lib/api";
import type { SearchResults } from "./query";

export function loadSearch(q: string, t: string, opts: { offset?: number; limit?: number; book?: number; prefix?: boolean; signal?: AbortSignal } = {}) {
  const p = new URLSearchParams({ q, t, offset: String(opts.offset ?? 0), limit: String(opts.limit ?? 50) });
  if (opts.book) p.set("book", String(opts.book));
  if (opts.prefix) p.set("prefix", "1");
  return getStudyData<SearchResults>(`/api/search?${p}`, { signal: opts.signal });
}
