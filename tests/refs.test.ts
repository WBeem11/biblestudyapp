import { describe, expect, it } from "vitest";
import {
  adjacentChapter,
  searchBooks,
  BOOKS,
  TOTAL_CHAPTERS,
  chapterOrdinal,
  decodeVerseId,
  findBook,
  formatRange,
  normalizeBookKey,
  parseOsisRange,
  parseReference,
  verseId,
} from "@/lib/refs";

describe("book metadata", () => {
  it("has 66 books and 1,189 chapters", () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS.filter((b) => b.testament === "OT")).toHaveLength(39);
    expect(TOTAL_CHAPTERS).toBe(1189);
  });

  it("has no alias that resolves to two different books", () => {
    const seen = new Map<string, string>();
    for (const b of BOOKS) {
      for (const k of [b.osis, b.name, b.slug, ...b.aliases]) {
        for (const key of [normalizeBookKey(k), normalizeBookKey(k).replace(/ /g, "")]) {
          const prev = seen.get(key);
          if (prev && prev !== b.osis) throw new Error(`"${key}" maps to ${prev} and ${b.osis}`);
          seen.set(key, b.osis);
        }
      }
    }
  });

  it("resolves names, slugs, OSIS ids, and abbreviations", () => {
    expect(findBook("John")?.id).toBe(43);
    expect(findBook("1-john")?.osis).toBe("1John");
    expect(findBook("1 Jn")?.osis).toBe("1John");
    expect(findBook("I John")?.osis).toBe("1John");
    expect(findBook("III John")?.osis).toBe("3John");
    expect(findBook("Revelation of John")?.osis).toBe("Rev");
    expect(findBook("Isaiah")?.osis).toBe("Isa");
    expect(findBook("Song of Solomon")?.osis).toBe("Song");
    expect(findBook("Ps.")?.osis).toBe("Ps");
    expect(findBook("Psalm")?.osis).toBe("Ps");
    expect(findBook("Phlm")?.name).toBe("Philemon");
    expect(findBook("Nope")).toBeUndefined();
  });

  it("computes chapter ordinals", () => {
    expect(chapterOrdinal(1, 1)).toBe(1);
    expect(chapterOrdinal(2, 1)).toBe(51);
    expect(chapterOrdinal(66, 22)).toBe(1189);
  });
});

describe("verse ids", () => {
  it("round-trips BBCCCVVV", () => {
    expect(verseId({ book: 43, chapter: 3, verse: 16 })).toBe(43003016);
    expect(decodeVerseId(19119176)).toEqual({ book: 19, chapter: 119, verse: 176 });
  });

  it("parses OSIS refs and ranges", () => {
    expect(parseOsisRange("John.3.16")).toEqual({ start: 43003016, end: 43003016 });
    expect(parseOsisRange("Gen.1.1-Gen.1.3")).toEqual({ start: 1001001, end: 1001003 });
    expect(parseOsisRange("Gen.1.3-Gen.1.1")).toBeNull();
    expect(parseOsisRange("Xyz.1.1")).toBeNull();
    expect(parseOsisRange("John.22.1")).toBeNull();
  });

  it("parses human references", () => {
    expect(parseReference("John 3:16")).toEqual({
      start: { book: 43, chapter: 3, verse: 16 },
      end: { book: 43, chapter: 3, verse: 16 },
    });
    expect(parseReference("1 Jn 4:8-10")?.end).toEqual({ book: 62, chapter: 4, verse: 10 });
    expect(parseReference("Rom 8:28–9:2")?.end).toEqual({ book: 45, chapter: 9, verse: 2 });
    expect(parseReference("Ps 23")?.end.verse).toBe(999);
    expect(parseReference("Gen 1-3")?.end.chapter).toBe(3);
    expect(parseReference("Song of Solomon 2:4")?.start.book).toBe(22);
    expect(parseReference("john 22:1")).toBeNull();
    expect(parseReference("John 3:16-3:10")).toBeNull();
    expect(parseReference("steadfast love")).toBeNull();
  });

  it("formats ranges", () => {
    expect(formatRange(43003016, 43003016)).toBe("John 3:16");
    expect(formatRange(43003016, 43003018)).toBe("John 3:16–18");
    expect(formatRange(45008028, 45009002)).toBe("Romans 8:28–9:2");
  });
});

describe("navigation helpers", () => {
  it("steps across book boundaries", () => {
    expect(adjacentChapter(43, 21, 1)).toMatchObject({ book: { osis: "Acts" }, chapter: 1 });
    expect(adjacentChapter(44, 1, -1)).toMatchObject({ book: { osis: "John" }, chapter: 21 });
    expect(adjacentChapter(43, 3, 1)).toMatchObject({ book: { osis: "John" }, chapter: 4 });
    expect(adjacentChapter(1, 1, -1)).toBeNull();
    expect(adjacentChapter(66, 22, 1)).toBeNull();
  });

  it("ranks book search results", () => {
    expect(searchBooks("jo").map((b) => b.osis)).toEqual(["Josh", "Job", "Joel", "Jonah", "John", "1John", "2John", "3John"]);
    expect(searchBooks("jn")[0].osis).toBe("John");
    expect(searchBooks("1 j")[0].osis).toBe("1John");
    expect(searchBooks("rev")[0].osis).toBe("Rev");
    expect(searchBooks("phil").map((b) => b.osis)).toEqual(["Phil", "Phlm"]);
    expect(searchBooks("")).toEqual([]);
  });
});

describe("reader url state", async () => {
  const { parseReaderState, readerQuery, DEFAULT_TRANSLATIONS } = await import("@/lib/reader/state");
  const q = (s: string) => new URLSearchParams(s);

  it("parses and validates params", () => {
    const none = { interlinear: false, lemma: null };
    expect(parseReaderState(q(""), 36)).toEqual({ translations: DEFAULT_TRANSLATIONS, verse: null, ...none });
    expect(parseReaderState(q("t=kjv&v=16"), 36)).toEqual({ translations: ["KJV"], verse: 16, ...none });
    expect(parseReaderState(q("t=KJV,BSB,KJV,XYZ"), 36).translations).toEqual(["KJV", "BSB"]);
    expect(parseReaderState(q("t=XYZ&v=99"), 36)).toEqual({ translations: DEFAULT_TRANSLATIONS, verse: null, ...none });
    expect(parseReaderState(q("i=1&l=G0026"), 36)).toMatchObject({ interlinear: true, lemma: "G0026" });
    expect(parseReaderState(q("l=DROP TABLE"), 36).lemma).toBeNull();
  });

  it("omits defaults when serializing", () => {
    expect(readerQuery({ translations: ["BSB", "KJV"] })).toBe("");
    expect(readerQuery({ translations: ["KJV"], verse: 16 })).toBe("?t=KJV&v=16");
    expect(readerQuery({ verse: 3 })).toBe("?v=3");
    expect(readerQuery({ verse: 3, interlinear: true, lemma: "H7225G" })).toBe("?v=3&i=1&l=H7225G");
  });
});

describe("psalm naming", () => {
  it("uses the singular before a number", () => {
    expect(findBook("Ps")?.name).toBe("Psalms");
    expect(formatRange(19023001, 19023006)).toBe("Psalm 23:1–6");
  });
});
