import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { chapterOrdinal, decodeVerseId, parseOsisRange } from "@/lib/refs";
import { RAW } from "./lib/paths";

/** OpenBible.info cross_references.txt: "From Verse<TAB>To Verse<TAB>Votes", OSIS refs. */
export function ingestCrossRefs(db: Database.Database) {
  const file = path.join(RAW, "openbible", "cross_references.txt");
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  if (!lines[0].startsWith("From Verse")) throw new Error("cross_references.txt: unexpected header");

  const known = new Set<number>(db.prepare("SELECT id FROM verses").pluck().all() as number[]);
  const ins = db.prepare(
    "INSERT INTO cross_refs (from_verse, to_verse_start, to_verse_end, votes) VALUES (?, ?, ?, ?)",
  );

  let inserted = 0;
  const rejected: string[] = [];
  const chapterAgg = new Map<string, { refs: number; weight: number }>();

  db.transaction(() => {
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const [fromRaw, toRaw, votesRaw] = line.split("\t");
      const from = parseOsisRange(fromRaw);
      const to = parseOsisRange(toRaw);
      const votes = Number(votesRaw);
      if (
        !from || !to || from.start !== from.end || !Number.isInteger(votes) ||
        !known.has(from.start) || !known.has(to.start) || !known.has(to.end)
      ) {
        rejected.push(line);
        continue;
      }
      ins.run(from.start, to.start, to.end, votes);
      inserted++;

      const a = decodeVerseId(from.start);
      const b = decodeVerseId(to.start);
      const oa = chapterOrdinal(a.book, a.chapter);
      const ob = chapterOrdinal(b.book, b.chapter);
      if (oa === ob) continue; // same-chapter refs have no arc at overview scale
      const key = oa < ob ? `${oa}:${ob}` : `${ob}:${oa}`;
      const agg = chapterAgg.get(key) ?? { refs: 0, weight: 0 };
      agg.refs++;
      agg.weight += Math.max(votes, 0);
      chapterAgg.set(key, agg);
    }

    const insEdge = db.prepare(
      "INSERT INTO chapter_edges (from_chapter_ord, to_chapter_ord, ref_count, weight) VALUES (?, ?, ?, ?)",
    );
    for (const [key, { refs, weight }] of chapterAgg) {
      const [a, b] = key.split(":").map(Number);
      insEdge.run(a, b, refs, weight);
    }
  })();

  return { inserted, rejected, chapterEdges: chapterAgg.size };
}
