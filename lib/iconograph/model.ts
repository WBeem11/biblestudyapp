/**
 * Canon axis and arc sets for the Iconograph. Client-safe, allocation-light.
 *
 * x is measured in "chapter units": chapter ordinal c occupies [c-1, c), so the whole canon
 * spans [0, 1189). Verse i (0-based) of chapter c sits at (c-1) + (i+0.5)/verseCount.
 */
import { BOOKS, TOTAL_CHAPTERS, chapterFromOrdinal, type BookMeta, type Genre } from "@/lib/refs";
import type { OverviewData, VerseEdges } from "./format";

export const GENRES: Genre[] = ["law", "history", "wisdom", "prophets", "gospels", "acts", "epistles", "apocalyptic"];

export class CanonAxis {
  readonly verseCounts: Uint16Array;
  /** Verse ordinal of the first verse in each chapter (index = chapter ordinal; 0 unused). */
  readonly chapterFirstVerse: Uint32Array;
  /** Book id per chapter ordinal (index = chapter ordinal). */
  readonly chapterBook: Uint8Array;
  readonly books: { book: BookMeta; start: number; end: number }[];

  constructor(verseCounts: Uint16Array) {
    this.verseCounts = verseCounts;
    this.chapterFirstVerse = new Uint32Array(TOTAL_CHAPTERS + 2);
    this.chapterBook = new Uint8Array(TOTAL_CHAPTERS + 1);
    let v = 1;
    for (let c = 1; c <= TOTAL_CHAPTERS; c++) {
      this.chapterFirstVerse[c] = v;
      v += verseCounts[c - 1];
    }
    this.chapterFirstVerse[TOTAL_CHAPTERS + 1] = v;
    let start = 0;
    this.books = BOOKS.map((book) => {
      for (let c = start + 1; c <= start + book.chapters; c++) this.chapterBook[c] = book.id;
      const r = { book, start, end: start + book.chapters };
      start = r.end;
      return r;
    });
  }

  /** Chapter ordinal containing a verse ordinal (binary search). */
  chapterOfVerse(verseOrd: number): number {
    let lo = 1;
    let hi = TOTAL_CHAPTERS;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.chapterFirstVerse[mid] <= verseOrd) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  verseX(verseOrd: number): number {
    const c = this.chapterOfVerse(verseOrd);
    return c - 1 + (verseOrd - this.chapterFirstVerse[c] + 0.5) / this.verseCounts[c - 1];
  }

  /** Book, chapter and verse number for a verse ordinal. */
  verseRef(verseOrd: number) {
    const c = this.chapterOfVerse(verseOrd);
    const loc = chapterFromOrdinal(c)!;
    return { ...loc, chapterOrd: c, verse: verseOrd - this.chapterFirstVerse[c] + 1 };
  }

  bookAt(x: number) {
    const c = Math.min(TOTAL_CHAPTERS, Math.max(1, Math.floor(x) + 1));
    return this.books[this.chapterBook[c] - 1];
  }
}

export type Testament = "OT" | "NT";
export type BridgeKind = 0 | 1 | 2; // 0 within OT, 1 within NT, 2 OT↔NT

export interface ArcSet {
  level: "chapter" | "verse";
  n: number;
  /** Endpoints in chapter units, x1 < x2. Sorted by strength ascending. */
  x1: Float64Array;
  x2: Float64Array;
  strength: Float32Array;
  kind: Uint8Array;
  /** Chapter ordinals of each endpoint (for genre filters and highlighting). */
  c1: Uint16Array;
  c2: Uint16Array;
  /** Chapter level: reference count. Verse level: [fromOrd, toStartOrd, toEndOrd] per arc. */
  refCount?: Uint16Array;
  verses?: Uint16Array;
}

const OT_LAST_CHAPTER = BOOKS.filter((b) => b.testament === "OT").reduce((n, b) => n + b.chapters, 0); // 929

function kindOf(c1: number, c2: number): BridgeKind {
  const a = c1 > OT_LAST_CHAPTER;
  const b = c2 > OT_LAST_CHAPTER;
  return a === b ? (a ? 1 : 0) : 2;
}

export function chapterArcs(o: OverviewData): ArcSet {
  const n = o.from.length;
  const s: ArcSet = {
    level: "chapter",
    n,
    x1: new Float64Array(n),
    x2: new Float64Array(n),
    strength: new Float32Array(n),
    kind: new Uint8Array(n),
    c1: o.from,
    c2: o.to,
    refCount: o.refCount,
  };
  for (let i = 0; i < n; i++) {
    s.x1[i] = o.from[i] - 0.5;
    s.x2[i] = o.to[i] - 0.5;
    s.strength[i] = o.weight[i];
    s.kind[i] = kindOf(o.from[i], o.to[i]);
  }
  return s;
}

/** Verse-level arcs. A ranged target is drawn to the middle of its range. Sorted by votes ascending. */
export function verseArcs(e: VerseEdges, axis: CanonAxis): ArcSet {
  const n = e.votes.length;
  const verses = new Uint16Array(n * 3);
  const s: ArcSet = {
    level: "verse",
    n,
    x1: new Float64Array(n),
    x2: new Float64Array(n),
    strength: new Float32Array(n),
    kind: new Uint8Array(n),
    c1: new Uint16Array(n),
    c2: new Uint16Array(n),
    verses,
  };
  for (let i = 0; i < n; i++) {
    const a = axis.verseX(e.from[i]);
    const b = (axis.verseX(e.toStart[i]) + axis.verseX(e.toEnd[i])) / 2;
    const ca = axis.chapterOfVerse(e.from[i]);
    const cb = axis.chapterOfVerse(e.toStart[i]);
    const swap = a > b;
    s.x1[i] = swap ? b : a;
    s.x2[i] = swap ? a : b;
    s.c1[i] = swap ? cb : ca;
    s.c2[i] = swap ? ca : cb;
    s.strength[i] = e.votes[i];
    s.kind[i] = kindOf(ca, cb);
    verses.set([e.from[i], e.toStart[i], e.toEnd[i]], i * 3);
  }
  return s;
}

export type TestamentFilter = "all" | "bridges" | "ot" | "nt";

export interface ArcFilters {
  /** Show the strongest N% of arcs that pass the other filters (1..100). */
  strongestPct: number;
  testament: TestamentFilter;
  genre: Genre | "all";
}

export const DEFAULT_FILTERS: ArcFilters = { strongestPct: 20, testament: "all", genre: "all" };

/** Indices of arcs passing the filters, weakest first (draw order). */
export function filterArcs(s: ArcSet, f: ArcFilters, axis: CanonAxis): Uint32Array {
  const genreOf = (c: number) => BOOKS[axis.chapterBook[c] - 1].genre;
  const keep = new Uint32Array(s.n);
  let m = 0;
  for (let i = 0; i < s.n; i++) {
    const k = s.kind[i];
    if (f.testament === "bridges" && k !== 2) continue;
    if (f.testament === "ot" && k !== 0) continue;
    if (f.testament === "nt" && k !== 1) continue;
    if (f.genre !== "all" && genreOf(s.c1[i]) !== f.genre && genreOf(s.c2[i]) !== f.genre) continue;
    keep[m++] = i;
  }
  const take = Math.max(1, Math.round((m * Math.min(100, Math.max(1, f.strongestPct))) / 100));
  return keep.slice(Math.max(0, m - take), m);
}

/** Indices (within `indices`) of arcs with an endpoint in chapter ordinal `c`. */
export function arcsTouchingChapter(s: ArcSet, indices: Uint32Array, c: number): number[] {
  const out: number[] = [];
  for (const i of indices) if (s.c1[i] === c || s.c2[i] === c) out.push(i);
  return out;
}
