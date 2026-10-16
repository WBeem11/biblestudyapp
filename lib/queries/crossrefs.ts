import { desc, eq } from "drizzle-orm";
import { db, sqlite } from "@/lib/db/client";
import { crossRefs } from "@/lib/db/schema";

/** Outgoing cross-references for a verse, most-voted first. */
export function getCrossRefs(verseId: number, limit = 50) {
  return db
    .select({
      toStart: crossRefs.toVerseStart,
      toEnd: crossRefs.toVerseEnd,
      votes: crossRefs.votes,
    })
    .from(crossRefs)
    .where(eq(crossRefs.fromVerse, verseId))
    .orderBy(desc(crossRefs.votes))
    .limit(limit)
    .all();
}

export interface CrossRefPreview {
  toStart: number;
  toEnd: number;
  votes: number;
  /** Text of the target range in the requested translation, capped at PREVIEW_VERSES verses. */
  text: string;
  truncated: boolean;
}

const PREVIEW_VERSES = 4;

// Drizzle has no clean way to express the correlated, capped group_concat; raw SQL it is.
const previewStmt = sqlite.prepare(`
  SELECT c.to_verse_start AS toStart,
         c.to_verse_end   AS toEnd,
         c.votes          AS votes,
         (SELECT group_concat(text, ' ') FROM (
            SELECT vt.text FROM verse_texts vt
            WHERE vt.translation_id = @t AND vt.verse_id BETWEEN c.to_verse_start AND c.to_verse_end
            ORDER BY vt.verse_id LIMIT ${PREVIEW_VERSES}
         )) AS text,
         (SELECT COUNT(*) FROM verses v WHERE v.id BETWEEN c.to_verse_start AND c.to_verse_end) AS span
  FROM cross_refs c
  WHERE c.from_verse = @verse
  ORDER BY c.votes DESC, c.to_verse_start
  LIMIT @limit
`);

const countStmt = sqlite.prepare("SELECT COUNT(*) FROM cross_refs WHERE from_verse = ?").pluck();

export function getCrossRefPreviews(verseId: number, translationId: string, limit = 100) {
  const rows = previewStmt.all({ verse: verseId, t: translationId, limit }) as Array<
    Omit<CrossRefPreview, "truncated" | "text"> & { text: string | null; span: number }
  >;
  const refs: CrossRefPreview[] = rows.map(({ span, text, ...r }) => ({
    ...r,
    text: text ?? "",
    truncated: span > PREVIEW_VERSES,
  }));
  return { total: countStmt.get(verseId) as number, refs };
}
