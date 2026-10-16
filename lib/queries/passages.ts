import { sqlite } from "@/lib/db/client";

const stmt = sqlite.prepare(`
  SELECT group_concat(text, ' ') AS text, COUNT(*) AS n FROM (
    SELECT text FROM verse_texts
    WHERE translation_id = @t AND verse_id BETWEEN @start AND @end
    ORDER BY verse_id LIMIT @max
  )
`);
const span = sqlite.prepare("SELECT COUNT(*) FROM verses WHERE id BETWEEN ? AND ?").pluck();

/** Text of a verse range in one translation, capped at `maxVerses` verses. */
export function getPassageText(start: number, end: number, translationId: string, maxVerses = 4) {
  const r = stmt.get({ t: translationId, start, end, max: maxVerses }) as { text: string | null };
  return { start, end, text: r.text ?? "", truncated: (span.get(start, end) as number) > maxVerses };
}
