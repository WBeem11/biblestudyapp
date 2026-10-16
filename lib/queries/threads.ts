import { sqlite } from "@/lib/db/client";
import type { ChapterThreads, ThreadRef, VerseReference } from "@/lib/threads/types";
import { chapterIdBounds } from "@/lib/refs";

const refsStmt = sqlite.prepare(`
  SELECT c.from_verse % 1000, c.to_verse_start, c.to_verse_end, c.votes, vt.ordinal
  FROM cross_refs c
  JOIN verses vt ON vt.id = c.to_verse_start
  WHERE c.from_verse BETWEEN ? AND ? AND c.votes > 0
  ORDER BY c.from_verse, c.votes DESC, c.to_verse_start
`);
const selfStmt = sqlite.prepare("SELECT MIN(ordinal), MAX(ordinal) FROM verses WHERE id BETWEEN ? AND ?");
const bookStartsStmt = sqlite.prepare("SELECT MIN(ordinal) FROM verses GROUP BY book_id ORDER BY book_id").pluck();
let bookStarts: number[] | null = null;

/**
 * Every cross-reference from a chapter, in one payload. Negative/zero-vote references (disputed by
 * OpenBible.info voters) are left out of the threads view; the per-verse sheet still lists them.
 */
export function getChapterThreads(bookId: number, chapter: number): ChapterThreads {
  const [lo, hi] = chapterIdBounds(bookId, chapter);
  return {
    refs: refsStmt.raw().all(lo, hi) as ThreadRef[],
    self: selfStmt.raw().get(lo, hi) as [number, number],
    bookStarts: (bookStarts ??= bookStartsStmt.all() as number[]),
  };
}

const verseRefsStmt = sqlite.prepare(`
  SELECT to_verse_start AS toStart, to_verse_end AS toEnd, votes
  FROM cross_refs WHERE from_verse = ? AND votes > 0
  ORDER BY to_verse_start, to_verse_end
`);
const passageStmt = sqlite.prepare(`
  SELECT verse_id AS id, text FROM verse_texts
  WHERE translation_id = ? AND verse_id BETWEEN ? AND ?
  ORDER BY verse_id LIMIT ?
`);
const spanStmt = sqlite.prepare("SELECT COUNT(*) FROM verses WHERE id BETWEEN ? AND ?").pluck();

/** Where one verse points: every positive-vote reference with its text verse by verse, canonical order. */
export function getVerseReferences(verseId: number, translationId: string, maxVerses = 6): VerseReference[] {
  return (verseRefsStmt.all(verseId) as Omit<VerseReference, "verses" | "truncated">[]).map((r) => ({
    ...r,
    verses: passageStmt.all(translationId, r.toStart, r.toEnd, maxVerses) as VerseReference["verses"],
    truncated: (spanStmt.get(r.toStart, r.toEnd) as number) > maxVerses,
  }));
}
