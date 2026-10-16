import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DB = path.join(import.meta.dirname, "..", "data", "bible.db");

// Requires `npm run db:build`; skipped on machines without the built database.
describe.skipIf(!fs.existsSync(DB))("database", async () => {
  const { sqlite } = await import("@/lib/db/client");
  const { getChapter, getChapterMeta } = await import("@/lib/queries/verses");
  const { getCrossRefs } = await import("@/lib/queries/crossrefs");
  const count = (sql: string) => (sqlite.prepare(sql).pluck().get() as number);

  it("has the full canon", () => {
    expect(count("SELECT COUNT(*) FROM books")).toBe(66);
    expect(count("SELECT COUNT(*) FROM chapters")).toBe(1189);
    expect(count("SELECT COUNT(*) FROM verses")).toBe(31102);
    expect(count("SELECT MAX(ordinal) FROM chapters")).toBe(1189);
  });

  it("has text for both translations", () => {
    expect(count("SELECT COUNT(*) FROM verse_texts WHERE translation_id = 'KJV'")).toBe(31102);
    expect(count("SELECT COUNT(*) FROM verse_texts WHERE translation_id = 'BSB'")).toBeGreaterThan(31080);
  });

  it("loads a chapter in parallel translations", () => {
    const john3 = getChapter(43, 3, ["BSB", "KJV"]);
    expect(john3).toHaveLength(36);
    expect(getChapterMeta(43, 3)?.verseCount).toBe(36);
    const v16 = john3.find((v) => v.verse === 16)!;
    expect(v16.text.KJV).toMatch(/^For God so loved the world/);
    expect(v16.text.BSB).toMatch(/one and only Son/);
  });

  it("keeps verses a translation omits, without text", () => {
    const matt17 = getChapter(40, 17, ["BSB", "KJV"]);
    const v21 = matt17.find((v) => v.verse === 21)!;
    expect(v21.text.BSB).toBeUndefined();
    expect(v21.text.KJV).toBeTruthy();
  });

  it("returns cross-references by votes", () => {
    const refs = getCrossRefs(43003016, 10);
    expect(refs.length).toBe(10);
    expect(refs[0].votes).toBeGreaterThanOrEqual(refs[9].votes);
    expect(count("SELECT COUNT(*) FROM cross_refs")).toBeGreaterThan(340000);
    expect(count("SELECT COUNT(*) FROM chapter_edges WHERE from_chapter_ord >= to_chapter_ord")).toBe(0);
  });

  it("supports full-text search", () => {
    const n = count(
      "SELECT COUNT(*) FROM verse_fts WHERE verse_fts MATCH '\"loving devotion\"' AND translation_id = 'BSB'",
    );
    expect(n).toBeGreaterThan(50);
  });
});

describe.skipIf(!fs.existsSync(DB))("reader queries", async () => {
  const { getChapter } = await import("@/lib/queries/verses");
  const { getCrossRefPreviews } = await import("@/lib/queries/crossrefs");

  it("counts cross-references per verse", () => {
    const v16 = getChapter(43, 3, ["BSB"]).find((v) => v.verse === 16)!;
    expect(v16.refCount).toBeGreaterThan(10);
  });

  it("previews cross-reference text in the requested translation", () => {
    const { total, refs } = getCrossRefPreviews(43003016, "KJV", 5);
    expect(total).toBeGreaterThan(5);
    expect(refs).toHaveLength(5);
    expect(refs.every((r) => r.text.length > 0)).toBe(true);
    expect(refs[0].votes).toBeGreaterThanOrEqual(refs[4].votes);
  });

  it("caps long ranges", () => {
    const { refs } = getCrossRefPreviews(1001001, "BSB", 200);
    const long = refs.find((r) => r.toEnd - r.toStart >= 4 && Math.floor(r.toEnd / 1000) === Math.floor(r.toStart / 1000));
    if (long) expect(long.truncated).toBe(true);
  });
});
