import { bookById, findBook } from "./books";

/**
 * Verse IDs are integers of the form BBCCCVVV (John 3:16 → 43003016).
 * Ordering by ID is canonical ordering, so ranges are integer comparisons.
 */
export interface VerseRef {
  book: number;
  chapter: number;
  verse: number;
}

export interface RangeRef {
  start: VerseRef;
  end: VerseRef;
}

export function verseId({ book, chapter, verse }: VerseRef): number {
  return book * 1_000_000 + chapter * 1_000 + verse;
}

export function decodeVerseId(id: number): VerseRef {
  return {
    book: Math.floor(id / 1_000_000),
    chapter: Math.floor(id / 1_000) % 1_000,
    verse: id % 1_000,
  };
}

/** First and last possible IDs of a chapter (verse 0 and 999), for BETWEEN queries. */
export function chapterIdBounds(book: number, chapter: number): [number, number] {
  const base = book * 1_000_000 + chapter * 1_000;
  return [base, base + 999];
}

/**
 * Parse OSIS ("John.3.16", "John.3.16-John.3.18") into verse IDs.
 * Returns null for malformed or unknown references.
 */
export function parseOsisRange(osis: string): { start: number; end: number } | null {
  const [a, b] = osis.trim().split("-");
  const start = parseOsisVerse(a);
  if (start === null) return null;
  if (b === undefined) return { start, end: start };
  const end = parseOsisVerse(b);
  if (end === null || end < start) return null;
  return { start, end };
}

function parseOsisVerse(s: string | undefined): number | null {
  if (!s) return null;
  const parts = s.split(".");
  if (parts.length !== 3) return null;
  const book = findBook(parts[0]);
  const chapter = Number(parts[1]);
  const verse = Number(parts[2]);
  if (!book || !Number.isInteger(chapter) || !Number.isInteger(verse)) return null;
  if (chapter < 1 || chapter > book.chapters || verse < 1 || verse > 999) return null;
  return verseId({ book: book.id, chapter, verse });
}

/**
 * Parse a human reference such as "John 3:16", "1 Jn 4:8-10", "Gen 1", "Rom 8:28–9:2", "Ps 23".
 * A chapter-only reference spans the whole chapter (verse 1 to 999 sentinel).
 */
export function parseReference(input: string): RangeRef | null {
  const m = input
    .trim()
    .replace(/[–—]/g, "-")
    .match(/^((?:[1-3]|i{1,3})\s*[a-z.]+(?:\s+of\s+[a-z]+)?|[a-z.]+(?:\s+of\s+[a-z]+)?)\s*(\d+)(?:[:.](\d+))?(?:\s*-\s*(\d+)(?:[:.](\d+))?)?$/i);
  if (!m) return null;
  const [, bookPart, ch1, v1, x, v2] = m;
  const book = findBook(bookPart);
  if (!book) return null;

  const c1 = Number(ch1);
  if (c1 < 1 || c1 > book.chapters) return null;

  // "Gen 1" or "Gen 1-3"
  if (v1 === undefined) {
    const c2 = x === undefined ? c1 : Number(x);
    if (v2 !== undefined || c2 < c1 || c2 > book.chapters) return null;
    return {
      start: { book: book.id, chapter: c1, verse: 1 },
      end: { book: book.id, chapter: c2, verse: 999 },
    };
  }

  const start = { book: book.id, chapter: c1, verse: Number(v1) };
  if (start.verse < 1) return null;
  if (x === undefined) return { start, end: start };

  // "3:16-18" (same chapter) or "3:16-4:2" (cross-chapter)
  const end =
    v2 === undefined
      ? { book: book.id, chapter: c1, verse: Number(x) }
      : { book: book.id, chapter: Number(x), verse: Number(v2) };
  if (end.chapter > book.chapters || verseId(end) < verseId(start)) return null;
  return { start, end };
}

export function formatVerse(ref: VerseRef): string {
  const b = bookById(ref.book);
  return `${b?.refName ?? "?"} ${ref.chapter}:${ref.verse}`;
}

export function formatRange(startId: number, endId: number): string {
  const s = decodeVerseId(startId);
  if (startId === endId) return formatVerse(s);
  const e = decodeVerseId(endId);
  if (s.book === e.book && s.chapter === e.chapter) return `${formatVerse(s)}–${e.verse}`;
  if (s.book === e.book) return `${formatVerse(s)}–${e.chapter}:${e.verse}`;
  return `${formatVerse(s)} – ${formatVerse(e)}`;
}
