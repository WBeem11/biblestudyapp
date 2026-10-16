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
