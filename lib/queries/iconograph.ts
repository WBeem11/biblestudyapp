import { sqlite } from "@/lib/db/client";
import type { OverviewData, VerseEdges } from "@/lib/iconograph/format";

let overviewCache: OverviewData | null = null;

/** All chapter-to-chapter edges plus verse counts. Static per database build, so memoized. */
export function getOverview(): OverviewData {
  if (overviewCache) return overviewCache;
  const rows = sqlite
    .prepare("SELECT from_chapter_ord, to_chapter_ord, ref_count, weight FROM chapter_edges ORDER BY weight")
    .raw()
    .all() as [number, number, number, number][];
  const n = rows.length;
  const d: OverviewData = {
    weight: new Uint32Array(n),
    refCount: new Uint16Array(n),
    from: new Uint16Array(n),
    to: new Uint16Array(n),
    verseCounts: new Uint16Array(
      sqlite.prepare("SELECT verse_count FROM chapters ORDER BY ordinal").pluck().all() as number[],
    ),
  };
  rows.forEach(([f, t, c, w], i) => {
    d.from[i] = f;
    d.to[i] = t;
    d.refCount[i] = c;
    d.weight[i] = w;
  });
  return (overviewCache = d);
}

const chapterBounds = sqlite.prepare(`
  SELECT (SELECT MIN(v.id) FROM verses v JOIN chapters c ON c.book_id = v.book_id AND c.chapter = v.chapter WHERE c.ordinal = @lo) AS lo,
         (SELECT MAX(v.id) FROM verses v JOIN chapters c ON c.book_id = v.book_id AND c.chapter = v.chapter WHERE c.ordinal = @hi) AS hi
`);

const verseEdgesStmt = sqlite.prepare(`
  SELECT c.votes, vf.ordinal, vs.ordinal, ve.ordinal
  FROM cross_refs c
  JOIN verses vf ON vf.id = c.from_verse
  JOIN verses vs ON vs.id = c.to_verse_start
  JOIN verses ve ON ve.id = c.to_verse_end
  WHERE (c.from_verse BETWEEN @lo AND @hi OR c.to_verse_start BETWEEN @lo AND @hi)
    AND c.votes >= @min
  ORDER BY c.votes
`);

/** Verse-level edges touching chapters [loChapter, hiChapter] (ordinals), lightest first. */
export function getVerseEdges(loChapter: number, hiChapter: number, minVotes: number): VerseEdges {
  const { lo, hi } = chapterBounds.get({ lo: loChapter, hi: hiChapter }) as { lo: number | null; hi: number | null };
  const rows = lo && hi ? (verseEdgesStmt.raw().all({ lo, hi, min: minVotes }) as [number, number, number, number][]) : [];
  const n = rows.length;
  const d: VerseEdges = { votes: new Int16Array(n), from: new Uint16Array(n), toStart: new Uint16Array(n), toEnd: new Uint16Array(n) };
  rows.forEach(([v, f, s, e], i) => {
    d.votes[i] = v;
    d.from[i] = f;
    d.toStart[i] = s;
    d.toEnd[i] = e;
  });
  return d;
}

const chapterIdRange = sqlite.prepare(
  "SELECT MIN(v.id) AS lo, MAX(v.id) AS hi FROM verses v JOIN chapters c ON c.book_id = v.book_id AND c.chapter = v.chapter WHERE c.ordinal = ?",
);

const pairStmt = sqlite.prepare(`
  SELECT from_verse AS "from", to_verse_start AS toStart, to_verse_end AS toEnd, votes
  FROM cross_refs
  WHERE (from_verse BETWEEN @aLo AND @aHi AND to_verse_start BETWEEN @bLo AND @bHi)
     OR (from_verse BETWEEN @bLo AND @bHi AND to_verse_start BETWEEN @aLo AND @aHi)
  ORDER BY votes DESC
  LIMIT @limit
`);

/** The most-voted verse references between two chapters (by ordinal). */
export function getChapterPairRefs(a: number, b: number, limit = 3) {
  const ra = chapterIdRange.get(a) as { lo: number; hi: number };
  const rb = chapterIdRange.get(b) as { lo: number; hi: number };
  if (!ra?.lo || !rb?.lo) return [];
  return pairStmt.all({ aLo: ra.lo, aHi: ra.hi, bLo: rb.lo, bHi: rb.hi, limit }) as {
    from: number;
    toStart: number;
    toEnd: number;
    votes: number;
  }[];
}
