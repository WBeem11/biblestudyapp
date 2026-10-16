import { and, asc, between, count, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { chapters, crossRefs, translations, verseTexts, verses } from "@/lib/db/schema";
import { chapterIdBounds } from "@/lib/refs";

export interface ChapterVerse {
  id: number;
  verse: number;
  /** outgoing cross-references from this verse */
  refCount: number;
  /** translation id → text; absent when a translation omits the verse */
  text: Record<string, string>;
}

export function getChapter(bookId: number, chapter: number, translationIds: string[]): ChapterVerse[] {
  const [lo, hi] = chapterIdBounds(bookId, chapter);
  const vs = db
    .select({ id: verses.id, verse: verses.verse })
    .from(verses)
    .where(between(verses.id, lo, hi))
    .orderBy(asc(verses.id))
    .all();

  const texts = db
    .select()
    .from(verseTexts)
    .where(and(between(verseTexts.verseId, lo, hi), inArray(verseTexts.translationId, translationIds)))
    .all();

  const refCounts = db
    .select({ verseId: crossRefs.fromVerse, n: count() })
    .from(crossRefs)
    .where(between(crossRefs.fromVerse, lo, hi))
    .groupBy(crossRefs.fromVerse)
    .all();

  const byId = new Map(vs.map((v) => [v.id, { ...v, refCount: 0, text: {} as Record<string, string> }]));
  for (const t of texts) byId.get(t.verseId)!.text[t.translationId] = t.text;
  for (const r of refCounts) byId.get(r.verseId)!.refCount = r.n;
  return [...byId.values()];
}

export function getChapterMeta(bookId: number, chapter: number) {
  return db
    .select()
    .from(chapters)
    .where(and(eq(chapters.bookId, bookId), eq(chapters.chapter, chapter)))
    .get();
}

export function listTranslations() {
  return db.select().from(translations).all();
}
