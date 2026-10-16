import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decodeOverview, decodeVerseEdges, encodeOverview, encodeVerseEdges } from "@/lib/iconograph/format";
import { assertAllowedApiPath } from "@/config/hermeneutics";
import { chapterOrdinal } from "@/lib/refs";

const DB = path.join(import.meta.dirname, "..", "data", "bible.db");

describe("iconograph wire format", () => {
  it("round-trips overview data", () => {
    const d = {
      weight: Uint32Array.of(1, 70000, 5),
      refCount: Uint16Array.of(1, 2, 3),
      from: Uint16Array.of(1, 2, 3),
      to: Uint16Array.of(4, 1189, 6),
      verseCounts: Uint16Array.of(31, 25, 24),
    };
    const back = decodeOverview(encodeOverview(d));
    for (const k of Object.keys(d) as (keyof typeof d)[]) expect([...back[k]]).toEqual([...d[k]]);
  });

  it("round-trips verse edges including negative votes", () => {
    const d = { votes: Int16Array.of(-86, 0, 1296), from: Uint16Array.of(1, 2, 31102), toStart: Uint16Array.of(5, 6, 7), toEnd: Uint16Array.of(5, 8, 7) };
    const back = decodeVerseEdges(encodeVerseEdges(d));
    for (const k of Object.keys(d) as (keyof typeof d)[]) expect([...back[k]]).toEqual([...d[k]]);
  });

  it("allows the iconograph API paths", () => {
    for (const p of ["/api/iconograph/overview", "/api/iconograph/edges?lo=1&hi=50&min=0", "/api/iconograph/pair/1/1100?t=BSB", "/api/passages?r=1-2"]) {
      expect(() => assertAllowedApiPath(p)).not.toThrow();
    }
  });
});

describe.skipIf(!fs.existsSync(DB))("iconograph queries", async () => {
  const { getOverview, getVerseEdges, getChapterPairRefs } = await import("@/lib/queries/iconograph");

  it("loads the full overview", () => {
    const o = getOverview();
    expect(o.verseCounts.length).toBe(1189);
    expect(o.verseCounts.reduce((a, b) => a + b, 0)).toBe(31102);
    expect(o.from.length).toBeGreaterThan(140000);
    expect(o.from.every((f, i) => f < o.to[i])).toBe(true);
  });

  it("loads verse edges touching a window", () => {
    const e = getVerseEdges(1, 1, 0); // Genesis 1 (verse ordinals 1..31)
    expect(e.votes.length).toBeGreaterThan(100);
    for (let i = 0; i < e.votes.length; i++) {
      expect(e.from[i] <= 31 || e.toStart[i] <= 31).toBe(true);
    }
  });

  it("finds the strongest refs between two chapters", () => {
    const refs = getChapterPairRefs(chapterOrdinal(1, 1), chapterOrdinal(43, 1), 3); // Genesis 1 ↔ John 1
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0].votes).toBeGreaterThan(50);
  });
});

describe("canon axis model", async () => {
  const { CanonAxis, chapterArcs, filterArcs, DEFAULT_FILTERS } = await import("@/lib/iconograph/model");
  const { hitTest } = await import("@/lib/iconograph/render");
  const { BOOKS } = await import("@/lib/refs");
  // Synthetic verse counts: 10 verses per chapter.
  const axis = new CanonAxis(new Uint16Array(1189).fill(10));

  it("maps verse ordinals to positions and references", () => {
    expect(axis.chapterOfVerse(1)).toBe(1);
    expect(axis.chapterOfVerse(10)).toBe(1);
    expect(axis.chapterOfVerse(11)).toBe(2);
    expect(axis.verseX(1)).toBeCloseTo(0.05);
    expect(axis.verseX(11890)).toBeCloseTo(1188.95);
    const r = axis.verseRef(11890);
    expect(r.book.osis).toBe("Rev");
    expect(r.chapter).toBe(22);
    expect(r.verse).toBe(10);
    expect(axis.books.at(-1)!.end).toBe(1189);
    expect(axis.bookAt(0).book.osis).toBe("Gen");
    expect(axis.bookAt(1188.5).book.osis).toBe(BOOKS[65].osis);
  });

  it("filters to the strongest share and by testament", () => {
    const s = chapterArcs({
      weight: Uint32Array.of(1, 2, 3, 4),
      refCount: Uint16Array.of(1, 1, 1, 1),
      from: Uint16Array.of(1, 1, 950, 2),
      to: Uint16Array.of(2, 1000, 1000, 3),
      verseCounts: new Uint16Array(1189).fill(10),
    });
    expect([...s.kind]).toEqual([0, 2, 1, 0]);
    expect([...filterArcs(s, { ...DEFAULT_FILTERS, strongestPct: 50 }, axis)]).toEqual([2, 3]);
    expect([...filterArcs(s, { ...DEFAULT_FILTERS, strongestPct: 100, testament: "bridges" }, axis)]).toEqual([1]);
    expect([...filterArcs(s, { ...DEFAULT_FILTERS, strongestPct: 100, genre: "gospels" }, axis)]).toEqual([1, 2]);
  });

  it("hit-tests arcs geometrically", () => {
    const s = chapterArcs({
      weight: Uint32Array.of(1),
      refCount: Uint16Array.of(1),
      from: Uint16Array.of(1),
      to: Uint16Array.of(201),
      verseCounts: new Uint16Array(1189).fill(10),
    });
    const vp = { width: 1189, height: 700, baseline: 600, yScale: 1, x: (u: number) => u };
    // Arc from x=0.5 to 200.5: center 100.5, radius 100 → apex at (100.5, 500).
    expect(hitTest(s, Uint32Array.of(0), vp, 100.5, 502)).toBe(0);
    expect(hitTest(s, Uint32Array.of(0), vp, 100.5, 560)).toBeNull();
    expect(hitTest(s, Uint32Array.of(0), vp, 100.5, 640)).toBeNull();
  });
});
