import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { findBook, verseId } from "@/lib/refs";
import { parseCsv } from "./lib/csv";
import { RAW } from "./lib/paths";

export type VerseMap = Map<number, string>;

function toId(bookName: string, chapter: number, verse: number): number {
  const book = findBook(bookName);
  if (!book) throw new Error(`Unknown book: "${bookName}"`);
  if (chapter < 1 || chapter > book.chapters) throw new Error(`Bad chapter: ${bookName} ${chapter}`);
  return verseId({ book: book.id, chapter, verse });
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** bsb.txt: two preamble lines, a header row, then "Genesis 1:1<TAB>text". */
export function readBsb(): VerseMap {
  const lines = fs.readFileSync(path.join(RAW, "bsb.txt"), "utf8").replace(/^﻿/, "").split(/\r?\n/);
  const header = lines.findIndex((l) => l.startsWith("Verse\t"));
  if (header < 0) throw new Error("bsb.txt: header row not found");

  const out: VerseMap = new Map();
  for (const line of lines.slice(header + 1)) {
    if (!line.trim()) continue;
    const [ref, text = ""] = line.split("\t");
    const m = ref.match(/^(.+) (\d+):(\d+)$/);
    if (!m) throw new Error(`bsb.txt: bad reference "${ref}"`);
    out.set(toId(m[1], Number(m[2]), Number(m[3])), clean(text));
  }
  return out;
}

/** KJV.csv (scrollmapper): Book,Chapter,Verse,Text with roman-numeral book prefixes. */
export function readKjv(): VerseMap {
  const rows = parseCsv(fs.readFileSync(path.join(RAW, "KJV.csv"), "utf8").replace(/^﻿/, ""));
  const out: VerseMap = new Map();
  let first = true;
  for (const row of rows) {
    if (first) {
      first = false;
      if (row[0] !== "Book") throw new Error(`KJV.csv: unexpected header ${row.join(",")}`);
      continue;
    }
    if (row.length === 1 && row[0] === "") continue;
    const [book, ch, vs, text] = row;
    out.set(toId(book, Number(ch), Number(vs)), clean(text));
  }
  return out;
}

export const TRANSLATIONS = [
  { id: "BSB", name: "Berean Standard Bible", license: "Public Domain" },
  { id: "KJV", name: "King James Version", license: "Public Domain" },
] as const;

export function ingestText(db: Database.Database, texts: Record<string, VerseMap>) {
  const insT = db.prepare("INSERT INTO translations (id, name, license) VALUES (?, ?, ?)");
  const insV = db.prepare("INSERT INTO verse_texts (verse_id, translation_id, text) VALUES (?, ?, ?)");
  const known = new Set<number>(
    (db.prepare("SELECT id FROM verses").pluck().all() as number[]),
  );
  const report: Record<string, { inserted: number; skipped: number[] }> = {};

  db.transaction(() => {
    for (const t of TRANSLATIONS) {
      insT.run(t.id, t.name, t.license);
      const map = texts[t.id];
      const r = (report[t.id] = { inserted: 0, skipped: [] as number[] });
      for (const [id, text] of map) {
        if (!known.has(id) || !text) {
          r.skipped.push(id);
          continue;
        }
        insV.run(id, t.id, text);
        r.inserted++;
      }
    }
  })();
  return report;
}
