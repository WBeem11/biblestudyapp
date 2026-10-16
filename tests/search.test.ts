import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toFtsQuery } from "@/lib/search/query";

const DB = path.join(import.meta.dirname, "..", "data", "bible.db");

describe("FTS query builder", () => {
  it("quotes every term so FTS5 syntax in input is inert", () => {
    expect(toFtsQuery("steadfast love")).toBe('"steadfast" "love"');
    expect(toFtsQuery('"loving devotion" mercy')).toBe('"loving devotion" "mercy"');
    expect(toFtsQuery("love OR hate")).toBe('"love" "OR" "hate"');
    expect(toFtsQuery("text:love NEAR(x y)")).toBe('"text love" "NEAR x" "y"');
    expect(toFtsQuery('"')).toBeNull();
    expect(toFtsQuery("   ")).toBeNull();
  });

  it("adds a prefix match to the last bare word when asked", () => {
    expect(toFtsQuery("good shephe", { prefixLast: true })).toBe('"good" "shephe"*');
    expect(toFtsQuery("go", { prefixLast: true })).toBe('"go"');
    expect(toFtsQuery('"good shepherd"', { prefixLast: true })).toBe('"good shepherd"');
  });
});

describe.skipIf(!fs.existsSync(DB))("verse search", async () => {
  const { searchVerses } = await import("@/lib/queries/search");
  const q = (s: string) => toFtsQuery(s)!;

  it("finds phrases in canonical order with highlighted snippets", () => {
    const r = searchVerses(q('"loving devotion"'), "BSB", 0, 10);
    expect(r.total).toBeGreaterThan(150);
    expect(r.items[0].verseId).toBeLessThan(r.items[9].verseId);
    expect(r.items[0].snippet).toContain("");
    expect(r.byBook!.reduce((a, b) => a + b, 0)).toBe(r.total);
  });

  it("searches per translation and per book", () => {
    expect(searchVerses(q('"loving devotion"'), "KJV", 0, 5).total).toBe(0);
    expect(searchVerses(q("lovingkindness"), "KJV", 0, 5).total).toBeGreaterThan(20);
    const ps = searchVerses(q("shepherd"), "BSB", 0, 50, 19);
    expect(ps.items.every((h) => Math.floor(h.verseId / 1_000_000) === 19)).toBe(true);
  });

  it("does not throw on hostile input", () => {
    expect(() => searchVerses(q('love" OR verse_id:1 --'), "BSB", 0, 5)).not.toThrow();
  });
});

describe.skipIf(!fs.existsSync(DB))("chapter threads", async () => {
  const { getChapterThreads } = await import("@/lib/queries/threads");
  const { assertAllowedApiPath } = await import("@/config/hermeneutics");

  it("returns every positive-vote reference from the chapter, strongest first per verse", () => {
    const { refs, self } = getChapterThreads(43, 3); // John 3
    expect(refs.length).toBeGreaterThan(200);
    expect(refs.every(([v, , , votes]) => v >= 1 && v <= 36 && votes > 0)).toBe(true);
    const v16 = refs.filter(([v]) => v === 16);
    expect(v16.length).toBeGreaterThan(10);
    expect(v16[0][3]).toBeGreaterThanOrEqual(v16.at(-1)![3]);
    expect(v16.some(([, s]) => s === 45005008)).toBe(true); // Romans 5:8
    expect(self[1] - self[0]).toBe(35); // 36 verses
    expect(refs.every(([, , , , o]) => o >= 1 && o <= 31102)).toBe(true);
    const { bookStarts } = getChapterThreads(1, 1);
    expect(bookStarts).toHaveLength(66);
    expect(bookStarts[0]).toBe(1);
  });

  it("allows the threads API path", () => {
    expect(() => assertAllowedApiPath("/api/threads/43/3")).not.toThrow();
  });
});
