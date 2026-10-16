import { sqlite } from "@/lib/db/client";
import { morphSegments } from "@/lib/concordance/morph";
import type { InterlinearChapter, InterlinearWord, LemmaDetail, OccurrencePage, SharedLemma } from "@/lib/concordance/types";
import { chapterIdBounds, chapterOrdinal } from "@/lib/refs";

const chapterWords = sqlite.prepare(`
  SELECT verse_id % 1000 AS v, position AS p, surface AS s, translit AS t, gloss AS g, strongs AS k, morph AS m, is_base AS b, language
  FROM words WHERE verse_id BETWEEN ? AND ? ORDER BY verse_id, position
`);
const morphStmt = sqlite.prepare("SELECT code, description FROM morph_codes WHERE code = ?");
const lemmaBrief = sqlite.prepare("SELECT lemma, gloss, occurrences FROM lemmas WHERE strongs = ?");

export function getInterlinear(bookId: number, chapter: number): InterlinearChapter {
  const [lo, hi] = chapterIdBounds(bookId, chapter);
  const rows = chapterWords.all(lo, hi) as (InterlinearWord & { language: string })[];
  const morph: Record<string, string> = {};
  const lemmas: InterlinearChapter["lemmas"] = {};
  for (const w of rows) {
    if (w.m) {
      for (const seg of morphSegments(w.m)) {
        if (morph[seg] !== undefined) continue;
        const r = morphStmt.get(seg) as { description: string } | undefined;
        morph[seg] = r?.description ?? "";
      }
    }
    if (w.k && !lemmas[w.k]) {
      const l = lemmaBrief.get(w.k) as { lemma: string; gloss: string | null; occurrences: number } | undefined;
      if (l) lemmas[w.k] = [l.lemma, l.gloss, l.occurrences];
    }
  }
  return {
    language: rows.some((w) => w.language === "grc") ? "grc" : "hbo",
    words: rows.map(({ v, p, s, t, g, k, m, b }) => ({ v, p, s, t, g, k, m, b })),
    morph,
    lemmas,
  };
}

const lemmaStmt = sqlite.prepare(
  "SELECT strongs, language, lemma, translit, gloss, definition, morph, occurrences FROM lemmas WHERE strongs = ?",
);
const byBookStmt = sqlite.prepare(
  "SELECT verse_id / 1000000 AS book, COUNT(*) AS n FROM words WHERE strongs = ? AND is_base = 1 GROUP BY book",
);
const chaptersStmt = sqlite.prepare(
  "SELECT DISTINCT verse_id / 1000000 AS book, (verse_id / 1000) % 1000 AS chapter FROM words WHERE strongs = ? AND is_base = 1",
);
const siblingsStmt = sqlite.prepare(
  "SELECT strongs, gloss, occurrences FROM lemmas WHERE substr(strongs, 1, 5) = ? AND strongs <> ? AND occurrences > 0 ORDER BY occurrences DESC",
);

export function getLemma(strongs: string): LemmaDetail | null {
  const l = lemmaStmt.get(strongs) as Omit<LemmaDetail, "byBook" | "siblings"> | undefined;
  if (!l) return null;
  const byBook = new Array(66).fill(0);
  for (const r of byBookStmt.all(strongs) as { book: number; n: number }[]) byBook[r.book - 1] = r.n;
  const chapters = (chaptersStmt.all(strongs) as { book: number; chapter: number }[])
    .map((r) => chapterOrdinal(r.book, r.chapter))
    .sort((a, b) => a - b);
  return { ...l, byBook, chapters, siblings: siblingsStmt.all(strongs.slice(0, 5), strongs) as LemmaDetail["siblings"] };
}

const occStmt = sqlite.prepare(`
  SELECT verse_id AS verseId, position, surface, gloss FROM words
  WHERE strongs = @s AND is_base = 1 AND verse_id BETWEEN @lo AND @hi
  ORDER BY verse_id, position LIMIT @limit OFFSET @offset
`);
const totalStmt = sqlite
  .prepare("SELECT COUNT(*) FROM words WHERE strongs = @s AND is_base = 1 AND verse_id BETWEEN @lo AND @hi")
  .pluck();
const verseWordsStmt = sqlite.prepare(
  "SELECT position, surface FROM words WHERE verse_id = ? AND is_base = 1 ORDER BY position",
);
const textStmt = sqlite.prepare("SELECT text FROM verse_texts WHERE verse_id = ? AND translation_id = ?").pluck();

const CONTEXT = 4;

/** Occurrences in the base text, optionally within one book (1..66). */
export function getOccurrences(strongs: string, translationId: string, offset: number, limit: number, book?: number): OccurrencePage {
  const range = book ? { lo: book * 1_000_000, hi: book * 1_000_000 + 999_999 } : { lo: 0, hi: 99_999_999 };
  const rows = occStmt.all({ s: strongs, limit, offset, ...range }) as { verseId: number; position: number; surface: string; gloss: string | null }[];
  const verseCache = new Map<number, { position: number; surface: string }[]>();
  const items = rows.map((r) => {
    let ws = verseCache.get(r.verseId);
    if (!ws) verseCache.set(r.verseId, (ws = verseWordsStmt.all(r.verseId) as { position: number; surface: string }[]));
    const i = ws.findIndex((w) => w.position === r.position);
    return {
      ...r,
      before: ws.slice(Math.max(0, i - CONTEXT), i).map((w) => w.surface),
      after: ws.slice(i + 1, i + 1 + CONTEXT).map((w) => w.surface),
      text: (textStmt.get(r.verseId, translationId) as string | undefined) ?? "",
    };
  });
  return { total: totalStmt.get({ s: strongs, ...range }) as number, offset, items };
}

/** Above this frequency a lemma is too common (articles, conjunctions, "God") to signal a link. */
export const SHARED_MAX_OCCURRENCES = 1200;

const sharedStmt = sqlite.prepare(`
  SELECT DISTINCT l.strongs, l.lemma, l.gloss, l.occurrences
  FROM words a
  JOIN words b ON b.strongs = a.strongs AND b.verse_id BETWEEN @bLo AND @bHi AND b.is_base = 1
  JOIN lemmas l ON l.strongs = a.strongs
  WHERE a.verse_id BETWEEN @aLo AND @aHi AND a.is_base = 1
    AND l.occurrences <= ${SHARED_MAX_OCCURRENCES} AND l.strongs NOT LIKE 'H90%'
  ORDER BY l.occurrences
  LIMIT 5
`);

/** Original-language lemmas two passages share, rarest first. Empty across Hebrew/Greek. */
export function getSharedLemmas(a: [number, number], b: [number, number]): SharedLemma[] {
  return sharedStmt.all({ aLo: a[0], aHi: a[1], bLo: b[0], bHi: b[1] }) as SharedLemma[];
}
