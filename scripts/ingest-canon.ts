import type Database from "better-sqlite3";
import { BOOKS, chapterOrdinal, decodeVerseId } from "@/lib/refs";

/**
 * Insert books, chapters, and verses. The verse list comes from the base
 * translation (BSB), so every verse that has text has a row.
 */
export function ingestCanon(db: Database.Database, verseIds: number[]) {
  const insBook = db.prepare(
    "INSERT INTO books (id, osis, name, testament, genre, chapters) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insChapter = db.prepare(
    "INSERT INTO chapters (ordinal, book_id, chapter, verse_count) VALUES (?, ?, ?, ?)",
  );
  const insVerse = db.prepare(
    "INSERT INTO verses (id, book_id, chapter, verse, ordinal) VALUES (?, ?, ?, ?, ?)",
  );

  const sorted = [...verseIds].sort((a, b) => a - b);
  const counts = new Map<number, number>(); // chapter ordinal → verse count
  for (const id of sorted) {
    const { book, chapter } = decodeVerseId(id);
    const ord = chapterOrdinal(book, chapter);
    counts.set(ord, (counts.get(ord) ?? 0) + 1);
  }

  db.transaction(() => {
    for (const b of BOOKS) {
      insBook.run(b.id, b.osis, b.name, b.testament, b.genre, b.chapters);
      for (let c = 1; c <= b.chapters; c++) {
        const ord = chapterOrdinal(b.id, c);
        const n = counts.get(ord);
        if (!n) throw new Error(`No verses for ${b.name} ${c}`);
        insChapter.run(ord, b.id, c, n);
      }
    }
    sorted.forEach((id, i) => {
      const { book, chapter, verse } = decodeVerseId(id);
      insVerse.run(id, book, chapter, verse, i + 1);
    });
  })();

  return { books: BOOKS.length, chapters: counts.size, verses: sorted.length };
}
