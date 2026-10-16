import { sqlite } from "@/lib/db/client";
import { MARK_CLOSE, MARK_OPEN, type SearchResults } from "@/lib/search/query";

const hitsStmt = sqlite.prepare(`
  SELECT verse_id AS verseId, snippet(verse_fts, 0, '${MARK_OPEN}', '${MARK_CLOSE}', '…', 40) AS snippet
  FROM verse_fts
  WHERE verse_fts MATCH @q AND translation_id = @t AND verse_id BETWEEN @lo AND @hi
  ORDER BY verse_id
  LIMIT @limit OFFSET @offset
`);
const countStmt = sqlite
  .prepare("SELECT COUNT(*) FROM verse_fts WHERE verse_fts MATCH @q AND translation_id = @t AND verse_id BETWEEN @lo AND @hi")
  .pluck();
const byBookStmt = sqlite.prepare(`
  SELECT CAST(verse_id / 1000000 AS INTEGER) AS book, COUNT(*) AS n
  FROM verse_fts WHERE verse_fts MATCH @q AND translation_id = @t GROUP BY book
`);

/** Full-text search in canonical order. `ftsQuery` must come from toFtsQuery(). */
export function searchVerses(ftsQuery: string, translationId: string, offset: number, limit: number, book?: number): SearchResults {
  const range = book ? { lo: book * 1_000_000, hi: book * 1_000_000 + 999_999 } : { lo: 0, hi: 99_999_999 };
  const p = { q: ftsQuery, t: translationId, ...range };
  const res: SearchResults = {
    total: countStmt.get(p) as number,
    offset,
    items: hitsStmt.all({ ...p, limit, offset }) as SearchResults["items"],
  };
  if (offset === 0) {
    res.byBook = new Array(66).fill(0);
    for (const r of byBookStmt.all({ q: ftsQuery, t: translationId }) as { book: number; n: number }[]) res.byBook[r.book - 1] = r.n;
  }
  return res;
}
