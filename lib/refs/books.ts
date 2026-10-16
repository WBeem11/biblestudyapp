export type Testament = "OT" | "NT";
export type Genre =
  | "law"
  | "history"
  | "wisdom"
  | "prophets"
  | "gospels"
  | "acts"
  | "epistles"
  | "apocalyptic";

export interface BookMeta {
  id: number; // 1..66, canonical (Protestant) order
  osis: string;
  name: string;
  /** Name used before a chapter or verse number ("Psalm 23", not "Psalms 23"). */
  refName: string;
  slug: string; // URL segment, e.g. '1-john'
  testament: Testament;
  genre: Genre;
  chapters: number;
  aliases: string[]; // extra lookup names (lowercased, no punctuation)
}

type Row = [osis: string, name: string, genre: Genre, chapters: number, aliases?: string[]];

const ROWS: Row[] = [
  ["Gen", "Genesis", "law", 50, ["ge", "gn"]],
  ["Exod", "Exodus", "law", 40, ["ex", "exo"]],
  ["Lev", "Leviticus", "law", 27, ["le", "lv"]],
  ["Num", "Numbers", "law", 36, ["nu", "nm", "nb"]],
  ["Deut", "Deuteronomy", "law", 34, ["dt", "deu"]],
  ["Josh", "Joshua", "history", 24, ["jos", "jsh"]],
  ["Judg", "Judges", "history", 21, ["jdg", "jg", "jdgs"]],
  ["Ruth", "Ruth", "history", 4, ["rth", "ru"]],
  ["1Sam", "1 Samuel", "history", 31, ["1sa", "1 sa", "1s"]],
  ["2Sam", "2 Samuel", "history", 24, ["2sa", "2 sa", "2s"]],
  ["1Kgs", "1 Kings", "history", 22, ["1ki", "1 ki", "1k"]],
  ["2Kgs", "2 Kings", "history", 25, ["2ki", "2 ki", "2k"]],
  ["1Chr", "1 Chronicles", "history", 29, ["1ch", "1 ch", "1 chron"]],
  ["2Chr", "2 Chronicles", "history", 36, ["2ch", "2 ch", "2 chron"]],
  ["Ezra", "Ezra", "history", 10, ["ezr"]],
  ["Neh", "Nehemiah", "history", 13, ["ne"]],
  ["Esth", "Esther", "history", 10, ["est", "es"]],
  ["Job", "Job", "wisdom", 42, ["jb"]],
  ["Ps", "Psalms", "wisdom", 150, ["psalm", "psa", "pss", "psm"]],
  ["Prov", "Proverbs", "wisdom", 31, ["pr", "prv", "pro"]],
  ["Eccl", "Ecclesiastes", "wisdom", 12, ["ec", "ecc", "qoh", "qoheleth"]],
  ["Song", "Song of Songs", "wisdom", 8, ["song of solomon", "sos", "so", "canticles", "sng"]],
  ["Isa", "Isaiah", "prophets", 66, ["is"]],
  ["Jer", "Jeremiah", "prophets", 52, ["je", "jr"]],
  ["Lam", "Lamentations", "prophets", 5, ["la"]],
  ["Ezek", "Ezekiel", "prophets", 48, ["eze", "ezk"]],
  ["Dan", "Daniel", "prophets", 12, ["da", "dn"]],
  ["Hos", "Hosea", "prophets", 14, ["ho"]],
  ["Joel", "Joel", "prophets", 3, ["jl"]],
  ["Amos", "Amos", "prophets", 9, ["am"]],
  ["Obad", "Obadiah", "prophets", 1, ["ob", "oba"]],
  ["Jonah", "Jonah", "prophets", 4, ["jon", "jnh"]],
  ["Mic", "Micah", "prophets", 7, ["mi"]],
  ["Nah", "Nahum", "prophets", 3, ["na"]],
  ["Hab", "Habakkuk", "prophets", 3, ["hb"]],
  ["Zeph", "Zephaniah", "prophets", 3, ["zep", "zp"]],
  ["Hag", "Haggai", "prophets", 2, ["hg"]],
  ["Zech", "Zechariah", "prophets", 14, ["zec", "zc"]],
  ["Mal", "Malachi", "prophets", 4, ["ml"]],
  ["Matt", "Matthew", "gospels", 28, ["mt", "mat"]],
  ["Mark", "Mark", "gospels", 16, ["mk", "mr", "mrk"]],
  ["Luke", "Luke", "gospels", 24, ["lk", "luk"]],
  ["John", "John", "gospels", 21, ["jn", "jhn", "joh"]],
  ["Acts", "Acts", "acts", 28, ["ac", "act"]],
  ["Rom", "Romans", "epistles", 16, ["ro", "rm"]],
  ["1Cor", "1 Corinthians", "epistles", 16, ["1co", "1 co"]],
  ["2Cor", "2 Corinthians", "epistles", 13, ["2co", "2 co"]],
  ["Gal", "Galatians", "epistles", 6, ["ga"]],
  ["Eph", "Ephesians", "epistles", 6, ["ephes"]],
  ["Phil", "Philippians", "epistles", 4, ["php", "pp"]],
  ["Col", "Colossians", "epistles", 4, ["co"]],
  ["1Thess", "1 Thessalonians", "epistles", 5, ["1th", "1 th", "1 thes"]],
  ["2Thess", "2 Thessalonians", "epistles", 3, ["2th", "2 th", "2 thes"]],
  ["1Tim", "1 Timothy", "epistles", 6, ["1ti", "1 ti"]],
  ["2Tim", "2 Timothy", "epistles", 4, ["2ti", "2 ti"]],
  ["Titus", "Titus", "epistles", 3, ["tit", "ti"]],
  ["Phlm", "Philemon", "epistles", 1, ["phm", "philem"]],
  ["Heb", "Hebrews", "epistles", 13, []],
  ["Jas", "James", "epistles", 5, ["jm", "jam"]],
  ["1Pet", "1 Peter", "epistles", 5, ["1pe", "1 pe", "1 pt"]],
  ["2Pet", "2 Peter", "epistles", 3, ["2pe", "2 pe", "2 pt"]],
  ["1John", "1 John", "epistles", 5, ["1jn", "1 jn", "1 jo"]],
  ["2John", "2 John", "epistles", 1, ["2jn", "2 jn", "2 jo"]],
  ["3John", "3 John", "epistles", 1, ["3jn", "3 jn", "3 jo"]],
  ["Jude", "Jude", "epistles", 1, ["jud", "jd"]],
  ["Rev", "Revelation", "apocalyptic", 22, ["re", "rv", "revelations", "revelation of john", "apocalypse"]],
];

export const BOOKS: readonly BookMeta[] = ROWS.map(([osis, name, genre, chapters, aliases = []], i) => ({
  id: i + 1,
  osis,
  name,
  refName: osis === "Ps" ? "Psalm" : name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  testament: i < 39 ? "OT" : "NT",
  genre,
  chapters,
  aliases,
}));

export const TOTAL_CHAPTERS = BOOKS.reduce((n, b) => n + b.chapters, 0); // 1189

/** Lowercase, drop periods, collapse whitespace, and turn "I/II/III John" into "1/2/3 john". */
export function normalizeBookKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(i{1,3}) (?=[a-z])/, (_, r: string) => `${r.length} `);
}

const byKey = new Map<string, BookMeta>();
for (const b of BOOKS) {
  const keys = [b.osis, b.name, b.slug, ...b.aliases];
  for (const k of keys) {
    const n = normalizeBookKey(k);
    byKey.set(n, b);
    byKey.set(n.replace(/ /g, ""), b); // '1 john' → '1john'
  }
}

export function bookById(id: number): BookMeta | undefined {
  return BOOKS[id - 1];
}

/** Resolve a book from an OSIS id, full name, URL slug, or common abbreviation. */
export function findBook(input: string): BookMeta | undefined {
  const n = normalizeBookKey(input);
  return byKey.get(n) ?? byKey.get(n.replace(/ /g, ""));
}

/** Chapter ordinal (1..1189) for a book/chapter pair. */
const chapterOffsets: number[] = [];
{
  let acc = 0;
  for (const b of BOOKS) {
    chapterOffsets.push(acc);
    acc += b.chapters;
  }
}

export function chapterOrdinal(bookId: number, chapter: number): number {
  return chapterOffsets[bookId - 1] + chapter;
}

/** The chapter `delta` steps away in canonical order, crossing book boundaries; null past either end. */
export function adjacentChapter(
  bookId: number,
  chapter: number,
  delta: 1 | -1,
): { book: BookMeta; chapter: number } | null {
  return chapterFromOrdinal(chapterOrdinal(bookId, chapter) + delta);
}

/** Book and chapter for a chapter ordinal (1..1189); null when out of range. */
export function chapterFromOrdinal(ord: number): { book: BookMeta; chapter: number } | null {
  if (!Number.isInteger(ord) || ord < 1 || ord > TOTAL_CHAPTERS) return null;
  let i = chapterOffsets.length - 1;
  while (chapterOffsets[i] >= ord) i--;
  return { book: BOOKS[i], chapter: ord - chapterOffsets[i] };
}

/** Rank books for a typed query: exact key, then name prefix, then key prefix, then substring. */
export function searchBooks(query: string, limit = 8): BookMeta[] {
  const q = normalizeBookKey(query);
  if (!q) return [];
  const qs = q.replace(/ /g, "");
  const scored: { b: BookMeta; s: number }[] = [];
  for (const b of BOOKS) {
    const name = normalizeBookKey(b.name);
    const keys = [b.osis, b.slug, ...b.aliases].map((k) => normalizeBookKey(k).replace(/ /g, ""));
    let s = 0;
    if (keys.includes(qs) || name === q) s = 4;
    else if (name.startsWith(q) || name.replace(/ /g, "").startsWith(qs)) s = 3;
    else if (keys.some((k) => k.startsWith(qs))) s = 2;
    else if (name.includes(q)) s = 1;
    if (s) scored.push({ b, s });
  }
  return scored
    .sort((x, y) => y.s - x.s || x.b.id - y.b.id)
    .slice(0, limit)
    .map((x) => x.b);
}
