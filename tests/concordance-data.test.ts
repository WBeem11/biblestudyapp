import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DB = path.join(import.meta.dirname, "..", "data", "bible.db");

// Validates the STEPBible ingest against published counts. Requires `npm run db:build`.
describe.skipIf(!fs.existsSync(DB))("original-language data", async () => {
  const { sqlite } = await import("@/lib/db/client");
  const one = (sql: string, ...p: unknown[]) => sqlite.prepare(sql).pluck().get(...p) as number;
  const occ = (s: string) => one("SELECT occurrences FROM lemmas WHERE strongs = ?", s);
  const baseWords = (v: number) => one("SELECT COUNT(*) FROM words WHERE verse_id = ? AND is_base = 1", v);

  it("has original-language words for every verse", () => {
    expect(one("SELECT COUNT(*) FROM verses v WHERE NOT EXISTS (SELECT 1 FROM words w WHERE w.verse_id = v.id)")).toBe(0);
  });

  it("matches known verse word counts", () => {
    expect(baseWords(1001001)).toBe(7); // Gen 1:1 בְּרֵאשִׁית בָּרָא אֱלֹהִים …
    expect(baseWords(43001001)).toBe(17); // John 1:1
    expect(baseWords(43003016)).toBe(25); // John 3:16
    expect(baseWords(64001014)).toBeGreaterThan(0); // 3 John 1:14 (NRSV 1:15 → KJV 1:14)
  });

  it("matches published NA28 lemma frequencies", () => {
    expect(occ("G0026")).toBe(116); // ἀγάπη
    expect(occ("G0025")).toBe(143); // ἀγαπάω
    expect(occ("G5485")).toBe(155); // χάρις
    expect(occ("G3056")).toBeGreaterThanOrEqual(329); // λόγος (330 in NA28)
  });

  it("has plausible totals for each testament", () => {
    const greekBase = one("SELECT COUNT(*) FROM words WHERE language = 'grc' AND is_base = 1");
    expect(greekBase).toBeGreaterThan(137_000);
    expect(greekBase).toBeLessThan(138_500);
    const hebrew = one("SELECT COUNT(*) FROM words WHERE language IN ('hbo','arc')");
    expect(hebrew).toBeGreaterThan(304_000);
    expect(hebrew).toBeLessThan(307_000);
    expect(one("SELECT COUNT(*) FROM words WHERE language = 'arc'")).toBeGreaterThan(4_000); // Daniel, Ezra portions
  });

  it("marks Textus Receptus-only words as non-base", () => {
    expect(one("SELECT SUM(is_base) FROM words WHERE verse_id = 40017021")).toBe(0); // Matt 17:21 (KJV only)
    expect(one("SELECT COUNT(*) FROM words WHERE verse_id = 40017021")).toBeGreaterThan(0);
  });

  it("links every tagged word to a lexicon entry", () => {
    expect(one("SELECT COUNT(*) FROM words WHERE strongs IS NULL AND strongs_all IS NOT NULL AND language = 'grc'")).toBe(0);
    expect(one("SELECT COUNT(*) FROM words w LEFT JOIN lemmas l ON l.strongs = w.strongs WHERE w.strongs IS NOT NULL AND l.strongs IS NULL")).toBe(0);
  });
});

describe.skipIf(!fs.existsSync(DB))("concordance queries", async () => {
  const { getInterlinear, getLemma, getOccurrences } = await import("@/lib/queries/concordance");
  const { describeMorph } = await import("@/lib/concordance/morph");
  const { assertAllowedApiPath } = await import("@/config/hermeneutics");

  it("loads a Hebrew chapter interlinear with morphology and lemmas", () => {
    const gen1 = getInterlinear(1, 1);
    expect(gen1.language).toBe("hbo");
    const first = gen1.words[0];
    expect(first).toMatchObject({ v: 1, p: 1, k: "H7225G" });
    expect(describeMorph(first.m, gen1.morph)).toMatch(/Preposition.*\+.*Noun.*Feminine.*Singular/);
    expect(gen1.lemmas.H1254A[0]).toBe("בָּרָא");
  });

  it("loads a Greek chapter and parses verbs into plain English", () => {
    const john3 = getInterlinear(43, 3);
    expect(john3.language).toBe("grc");
    const loved = john3.words.find((w) => w.v === 16 && w.k === "G0025")!;
    expect(describeMorph(loved.m, john3.morph)).toBe("Verb · Aorist · Active · Indicative · 3rd person · Singular");
  });

  it("returns lemma detail with distribution and sibling senses", () => {
    const agape = getLemma("G0026")!;
    expect(agape.lemma).toBe("ἀγάπη");
    expect(agape.byBook.reduce((a, b) => a + b, 0)).toBe(agape.occurrences);
    expect(agape.byBook[45]).toBeGreaterThan(10); // 1 Corinthians
    expect(getLemma("H0430G")!.siblings.length).toBeGreaterThan(0);
    expect(getLemma("G9999Z")).toBeNull();
  });

  it("pages occurrences with keyword-in-context", () => {
    const page = getOccurrences("G0026", "BSB", 0, 10);
    expect(page.total).toBe(116);
    expect(page.items).toHaveLength(10);
    expect(page.items[0].surface).toMatch(/ἀγάπ/);
    expect(page.items[0].text.length).toBeGreaterThan(10);
    expect(page.items.some((o) => o.before.length || o.after.length)).toBe(true);
    expect(getOccurrences("G0026", "BSB", 110, 10).items).toHaveLength(6);
    const cor = getOccurrences("G0026", "BSB", 0, 50, 46); // 1 Corinthians
    expect(cor.total).toBeGreaterThan(10);
    expect(cor.items.every((o) => Math.floor(o.verseId / 1_000_000) === 46)).toBe(true);
  });

  it("allows the concordance API paths", () => {
    for (const p of ["/api/interlinear/43/3", "/api/lemmas/G0026", "/api/lemmas/H7225G/occurrences?t=BSB&offset=0"]) {
      expect(() => assertAllowedApiPath(p)).not.toThrow();
    }
    expect(() => assertAllowedApiPath("/api/lemmas/G0026/summary")).toThrow();
  });
});

describe.skipIf(!fs.existsSync(DB))("cross-links", async () => {
  const { getLemma, getSharedLemmas } = await import("@/lib/queries/concordance");

  it("lists the chapters a lemma occurs in", () => {
    const agape = getLemma("G0026")!;
    expect(agape.chapters.length).toBeGreaterThan(40);
    expect(agape.chapters.every((c) => c > 929)).toBe(true); // NT only
  });

  it("finds rare words two passages share, and none across languages", () => {
    // John 3:16 and 1 John 4:9 share μονογενής ("only begotten").
    const shared = getSharedLemmas([43003016, 43003016], [62004009, 62004009]);
    expect(shared.map((s) => s.strongs)).toContain("G3439");
    expect(shared[0].occurrences).toBeLessThanOrEqual(shared.at(-1)!.occurrences);
    expect(getSharedLemmas([1001001, 1001001], [43001001, 43001003])).toEqual([]); // Gen 1:1 (Hebrew) ↔ John 1:1–3 (Greek)
  });
});
