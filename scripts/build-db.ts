/**
 * Rebuild data/bible.db from the raw files in data/raw/.
 *   npm run db:build
 */
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { assertVerifiedTables } from "@/config/hermeneutics";
import { formatRange } from "@/lib/refs";
import { ingestCanon } from "./ingest-canon";
import { ingestCrossRefs } from "./ingest-crossrefs";
import { ingestOriginal } from "./ingest-original";
import { ingestText, readBsb, readKjv } from "./ingest-text";
import { DB_FILE, MIGRATIONS } from "./lib/paths";

const t0 = performance.now();
const tmp = `${DB_FILE}.tmp`;
fs.rmSync(tmp, { force: true });

const db = new Database(tmp);
db.pragma("journal_mode = OFF");
db.pragma("synchronous = OFF");
db.pragma("foreign_keys = ON");

migrate(drizzle(db), { migrationsFolder: MIGRATIONS });

const bsb = readBsb();
const kjv = readKjv();
console.log(`read BSB ${bsb.size} verses, KJV ${kjv.size} verses`);

const canon = ingestCanon(db, [...bsb.keys()]);
console.log(`canon: ${canon.books} books, ${canon.chapters} chapters, ${canon.verses} verses`);

const text = ingestText(db, { BSB: bsb, KJV: kjv });
for (const [t, r] of Object.entries(text)) {
  console.log(`text ${t}: ${r.inserted} inserted, ${r.skipped.length} skipped`);
  if (r.skipped.length) console.log(`  skipped: ${r.skipped.slice(0, 10).map((id) => formatRange(id, id)).join(", ")}`);
}
const kjvOnlyMissing = [...bsb.keys()].filter((id) => !kjv.has(id));
if (kjvOnlyMissing.length) console.log(`  KJV lacks ${kjvOnlyMissing.length} BSB verses`);

const xr = ingestCrossRefs(db);
console.log(`cross-refs: ${xr.inserted} inserted, ${xr.rejected.length} rejected, ${xr.chapterEdges} chapter edges`);
if (xr.rejected.length) console.log(`  e.g. ${xr.rejected.slice(0, 5).join(" | ")}`);

const orig = ingestOriginal(db);
const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${k}×${n}`).join(", ");
console.log(`lexicon: ${orig.lemmas} lemmas (${orig.duplicateLemmas} duplicate keys ignored), ${orig.morphCodes} morphology codes`);
console.log(
  `hebrew: ${orig.hebrew.inserted} words from ${orig.hebrew.rows} rows (${orig.hebrew.emptyQere} empty Qere, ${orig.hebrew.unknownVerse.length} unknown verses)`,
);
console.log(
  `greek: ${orig.greek.inserted} words (${orig.greek.base} NA27/28 base) from ${orig.greek.rows} rows (${orig.greek.otherEditionOnly} other-edition-only, ${orig.greek.unknownVerse.length} unknown verses)`,
);
for (const [label, list] of [["hebrew", orig.hebrew.unknownVerse], ["greek", orig.greek.unknownVerse]] as const) {
  if (list.length) console.log(`  ${label} unknown verses: ${[...new Set(list.map((r) => r.split("#")[0]))].join(", ")}`);
}
if (orig.missingLemma.size) console.log(`  words whose lemma is missing from the lexicon: ${orig.missingLemma.size} keys (${top(orig.missingLemma)})`);
if (orig.missingMorph.size) console.log(`  morphology segments without an expansion: ${orig.missingMorph.size} codes (${top(orig.missingMorph)})`);
const accounted = orig.hebrew.inserted + orig.hebrew.emptyQere + orig.hebrew.unknownVerse.length;
if (accounted !== orig.hebrew.rows) throw new Error(`hebrew rows unaccounted: ${orig.hebrew.rows - accounted}`);
const gAccounted = orig.greek.inserted + orig.greek.otherEditionOnly + orig.greek.unknownVerse.length;
if (gAccounted !== orig.greek.rows) throw new Error(`greek rows unaccounted: ${orig.greek.rows - gAccounted}`);

// Hermeneutical guardrail: refuse to ship a database with unverified tables.
assertVerifiedTables(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all() as string[]);

const fk = db.pragma("foreign_key_check") as unknown[];
if (fk.length) throw new Error(`foreign key violations: ${fk.length}`);

// Compact first, then build FTS: VACUUM may renumber verse_texts rowids.
db.exec("VACUUM");
db.exec("INSERT INTO verse_fts(verse_fts) VALUES('rebuild')");
db.exec("INSERT INTO verse_fts(verse_fts) VALUES('optimize')");
db.exec("ANALYZE");
db.close();

fs.renameSync(tmp, DB_FILE);
const mb = (fs.statSync(DB_FILE).size / 1e6).toFixed(1);
console.log(`wrote ${DB_FILE} (${mb} MB) in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
