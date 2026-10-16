import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { findBook, verseId } from "@/lib/refs";
import { RAW } from "./lib/paths";

const DIR = path.join(RAW, "stepbible");

/** STEPBible three-letter book codes that our general book lookup doesn't already resolve. */
const STEP_BOOKS: Record<string, string> = { Rut: "Ruth", Jol: "Joel", Amo: "Amos", Nam: "Nah" };

const bookCache = new Map<string, number>();
function stepBook(code: string): number {
  let id = bookCache.get(code);
  if (id === undefined) {
    const b = findBook(STEP_BOOKS[code] ?? code);
    if (!b) throw new Error(`Unknown STEPBible book code ${code}`);
    bookCache.set(code, (id = b.id));
  }
  return id;
}

/**
 * "Gen.31.55(32.1)#01=L", "3Jn.1.15[1.14]#01=NKO", "1Ti.6.21{6.22}#08=NKO".
 * TAHOT: primary = English, (…) = Hebrew. TAGNT: primary = NRSV, […] = KJV, (…) = NA, {…} = others.
 * Our verses follow KJV/BSB numbering, so a […] KJV reference wins when present.
 */
const REF = /^([1-3A-Za-z]{3})\.(\d+)\.(\d+)((?:[([{][\d.]+[)\]}])*)#(\d+)=(\S+)$/;
const LOOKS_LIKE_DATA = /^[1-3A-Za-z]{3}\.\d+\.\d+\S*#\d+=/;

/**
 * Source files mix canonically-equivalent encodings (e.g. Greek oxia U+1F71 vs tonos U+03AC).
 * Normalize to NFC so stored text compares and searches consistently.
 */
function readNfc(file: string): string[] {
  return fs.readFileSync(path.join(DIR, file), "utf8").normalize("NFC").split(/\r?\n/);
}

function* dataRows(file: string): Generator<{ verse: number; edition: string; cols: string[] }> {
  for (const line of readNfc(file)) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const ref = line.slice(0, tab);
    const m = ref.match(REF);
    if (!m) {
      if (LOOKS_LIKE_DATA.test(ref)) throw new Error(`${file}: unparsed word reference "${ref}"`);
      continue;
    }
    const [, book, ch, vs, alts, , edition] = m;
    const kjv = alts.match(/\[(\d+)\.(\d+)\]/);
    const chapter = Number(kjv ? kjv[1] : ch);
    // Psalm titles are verse 0 in STEPBible; BSB/KJV fold them into verse 1.
    const verse = Math.max(1, Number(kjv ? kjv[2] : vs));
    yield { verse: verseId({ book: stepBook(book), chapter, verse }), edition, cols: line.split("\t") };
  }
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

interface Report {
  lemmas: number;
  duplicateLemmas: number;
  morphCodes: number;
  hebrew: { rows: number; inserted: number; emptyQere: number; unknownVerse: string[] };
  greek: { rows: number; inserted: number; base: number; otherEditionOnly: number; unknownVerse: string[] };
  missingLemma: Map<string, number>;
  missingMorph: Map<string, number>;
}

export function ingestOriginal(db: Database.Database): Report {
  const report: Report = {
    lemmas: 0,
    duplicateLemmas: 0,
    morphCodes: 0,
    hebrew: { rows: 0, inserted: 0, emptyQere: 0, unknownVerse: [] },
    greek: { rows: 0, inserted: 0, base: 0, otherEditionOnly: 0, unknownVerse: [] },
    missingLemma: new Map(),
    missingMorph: new Map(),
  };
  const known = new Set<number>(db.prepare("SELECT id FROM verses").pluck().all() as number[]);

  // Lexicons ------------------------------------------------------------------
  const insLemma = db.prepare(
    "INSERT OR IGNORE INTO lemmas (strongs, language, lemma, translit, gloss, definition, morph) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const lemmaKeys = new Set<string>();
  /** First dStrong for each plain Strong's number, for keys the lexicon spells differently. */
  const firstByBase = new Map<string, string>();
  db.transaction(() => {
    for (const file of ["TBESH.txt", "TBESG.txt"]) {
      for (const line of readNfc(file)) {
        if (!/^[HG]\d{4}/.test(line)) continue;
        const c = line.split("\t");
        if (c.length < 8) continue;
        const key = c[1].split(/\s/)[0];
        if (!/^[HG]\d{4}[A-Za-z]?$/.test(key)) continue;
        const morph = c[5];
        const language = key[0] === "G" ? "grc" : morph.startsWith("A:") ? "arc" : "hbo";
        const r = insLemma.run(key, language, c[3].trim(), c[4].trim() || null, clean(c[6]) || null, stripHtml(c[7]) || null, morph || null);
        if (r.changes) {
          report.lemmas++;
          lemmaKeys.add(key);
          if (!firstByBase.has(key.slice(0, 5))) firstByBase.set(key.slice(0, 5), key);
        } else report.duplicateLemmas++;
      }
    }
  })();

  // Morphology codes ------------------------------------------------------------
  const insMorph = db.prepare("INSERT OR IGNORE INTO morph_codes (code, description) VALUES (?, ?)");
  const morphKeys = new Set<string>();
  db.transaction(() => {
    for (const file of ["TEHMC.txt", "TEGMC.txt"]) {
      for (const line of fs.readFileSync(path.join(DIR, file), "utf8").split(/\r?\n/)) {
        const m = line.match(/^([A-Z][A-Za-z0-9-]*)\t(Function=[^\t]*)/);
        if (!m) continue;
        // "Stem=Qal (hence Action=Simple; Voice=Active)" → "Stem=Qal": keep the parse, drop the gloss.
        const desc = m[2].replace(/\s*\(hence [^)]*\)/g, "").replace(/\s*;\s*/g, "; ").trim();
        if (insMorph.run(m[1], desc).changes) {
          report.morphCodes++;
          morphKeys.add(m[1]);
        }
      }
    }
  })();

  const noteMorph = (code: string) => {
    // Hebrew codes carry the language letter only on the first segment: "HR/Ncfsa" → HR, HNcfsa.
    const lang = code[0];
    const segs = /^[HA]/.test(code) ? code.slice(1).split("/").filter(Boolean).map((s) => lang + s) : code.split(" + ");
    for (const s of segs) if (!morphKeys.has(s)) report.missingMorph.set(s, (report.missingMorph.get(s) ?? 0) + 1);
  };
  // Some text tags use a disambiguation letter the brief lexicon lacks (H0430J) or omit one it
  // requires (G2453 → G2453G); fall back to the lexicon's first entry for that Strong's number.
  const lemmaOrNull = (s: string | null) => {
    if (!s || lemmaKeys.has(s)) return s;
    const fallback = firstByBase.get(s.slice(0, 5));
    if (fallback) return fallback;
    report.missingLemma.set(s, (report.missingLemma.get(s) ?? 0) + 1);
    return null;
  };

  // Words -------------------------------------------------------------------------
  const insWord = db.prepare(
    `INSERT INTO words (verse_id, position, surface, translit, language, strongs, strongs_all, morph, gloss, edition, is_base)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const positions = new Map<number, number>();
  const nextPos = (v: number) => {
    const p = (positions.get(v) ?? 0) + 1;
    positions.set(v, p);
    return p;
  };

  db.transaction(() => {
    for (const file of ["TAHOT-Gen-Deu.txt", "TAHOT-Jos-Est.txt", "TAHOT-Job-Sng.txt", "TAHOT-Isa-Mal.txt"]) {
      for (const { verse, edition, cols } of dataRows(file)) {
        report.hebrew.rows++;
        const [, heb, translit, gloss, dStrongs, grammar] = cols;
        const surface = heb.replace(/[/\\]/g, "").trim();
        if (!surface) {
          report.hebrew.emptyQere++; // the Qere omits a word the Ketiv has
          continue;
        }
        if (!known.has(verse)) {
          report.hebrew.unknownVerse.push(cols[0]);
          continue;
        }
        const main = dStrongs.match(/\{([HG]\d{4}[A-Za-z]?)\}/)?.[1] ?? dStrongs.match(/H(?!90)\d{4}[A-Za-z]?/)?.[0] ?? null;
        noteMorph(grammar);
        insWord.run(
          verse,
          nextPos(verse),
          surface,
          translit.replace(/\//g, "") || null,
          grammar.startsWith("A") ? "arc" : "hbo",
          lemmaOrNull(main),
          dStrongs || null,
          grammar || null,
          clean(gloss.replace(/\//g, " ")) || null,
          edition,
          1,
        );
        report.hebrew.inserted++;
      }
    }

    for (const file of ["TAGNT-Mat-Jhn.txt", "TAGNT-Act-Rev.txt"]) {
      for (const { verse, edition, cols } of dataRows(file)) {
        report.greek.rows++;
        // Editions outside brackets: N = NA27/28 (base), K = KJV's Textus Receptus, O = other.
        const top = edition.replace(/\([^)]*\)/g, "");
        const isBase = /[Nn]/.test(top);
        if (!isBase && !/[Kk]/.test(top)) {
          report.greek.otherEditionOnly++;
          continue;
        }
        if (!known.has(verse)) {
          report.greek.unknownVerse.push(cols[0]);
          continue;
        }
        const [, greek, gloss, strongGrammar] = cols;
        const m = greek.match(/^(.*?)\s*\((.*)\)\s*$/);
        // Crasis joins two words: "G1473=P-1NS + G2532=CONJ" (κἀγώ). The first part is the main lemma.
        const parts = strongGrammar.split(" + ").map((p) => p.split("="));
        const strongs = parts[0][0];
        const grammar = parts.map((p) => p[1]).join(" + ");
        noteMorph(grammar);
        insWord.run(
          verse,
          nextPos(verse),
          (m?.[1] ?? greek).trim(),
          m?.[2]?.trim() || null,
          "grc",
          lemmaOrNull(strongs?.trim() || null),
          parts.map((p) => p[0].trim()).join("+") || null,
          grammar?.trim() || null,
          clean(gloss.replace(/\{\d+\}/g, "")) || null, // "{22} <the>": drop verse markers
          edition,
          isBase ? 1 : 0,
        );
        report.greek.inserted++;
        if (isBase) report.greek.base++;
      }
    }

    db.exec(`
      UPDATE lemmas SET occurrences = (
        SELECT COUNT(*) FROM words w WHERE w.strongs = lemmas.strongs AND w.is_base = 1
      )
    `);
  })();

  return report;
}
