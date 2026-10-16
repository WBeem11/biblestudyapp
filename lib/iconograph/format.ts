/**
 * Binary wire formats for Iconograph edge data (little-endian, typed-array friendly).
 * Shared by the API routes (encode) and the client (decode). Client-safe.
 *
 * Overview  (v1): Uint32[4]  header [version, chapterCount, edgeCount, 0]
 *                 Uint32[n]  weight      (sum of positive votes)
 *                 Uint16[n]  refCount
 *                 Uint16[n]  fromChapter (chapter ordinal, 1-based; from < to)
 *                 Uint16[n]  toChapter
 *                 Uint16[c]  verseCount per chapter ordinal
 *
 * Verse edges (v1): Uint32[2] header [version, edgeCount]
 *                 Int16[n]   votes
 *                 Uint16[n]  fromVerse   (verse ordinal, 1-based)
 *                 Uint16[n]  toStart
 *                 Uint16[n]  toEnd
 */

export const FORMAT_VERSION = 1;

export interface OverviewData {
  weight: Uint32Array;
  refCount: Uint16Array;
  from: Uint16Array;
  to: Uint16Array;
  verseCounts: Uint16Array;
}

export interface VerseEdges {
  votes: Int16Array;
  from: Uint16Array;
  toStart: Uint16Array;
  toEnd: Uint16Array;
}

export function encodeOverview(d: OverviewData): ArrayBuffer {
  const n = d.weight.length;
  const c = d.verseCounts.length;
  const buf = new ArrayBuffer(16 + n * 4 + n * 2 * 3 + c * 2);
  new Uint32Array(buf, 0, 4).set([FORMAT_VERSION, c, n, 0]);
  let o = 16;
  new Uint32Array(buf, o, n).set(d.weight);
  o += n * 4;
  for (const a of [d.refCount, d.from, d.to]) {
    new Uint16Array(buf, o, n).set(a);
    o += n * 2;
  }
  new Uint16Array(buf, o, c).set(d.verseCounts);
  return buf;
}

export function decodeOverview(buf: ArrayBuffer): OverviewData {
  const [version, c, n] = new Uint32Array(buf, 0, 3);
  if (version !== FORMAT_VERSION) throw new Error(`Unsupported overview format v${version}`);
  let o = 16;
  const weight = new Uint32Array(buf, o, n);
  o += n * 4;
  const u16 = () => {
    const a = new Uint16Array(buf, o, n);
    o += n * 2;
    return a;
  };
  const refCount = u16();
  const from = u16();
  const to = u16();
  return { weight, refCount, from, to, verseCounts: new Uint16Array(buf, o, c) };
}

export function encodeVerseEdges(d: VerseEdges): ArrayBuffer {
  const n = d.votes.length;
  const buf = new ArrayBuffer(8 + n * 2 * 4);
  new Uint32Array(buf, 0, 2).set([FORMAT_VERSION, n]);
  new Int16Array(buf, 8, n).set(d.votes);
  let o = 8 + n * 2;
  for (const a of [d.from, d.toStart, d.toEnd]) {
    new Uint16Array(buf, o, n).set(a);
    o += n * 2;
  }
  return buf;
}

export function decodeVerseEdges(buf: ArrayBuffer): VerseEdges {
  const [version, n] = new Uint32Array(buf, 0, 2);
  if (version !== FORMAT_VERSION) throw new Error(`Unsupported edges format v${version}`);
  let o = 8 + n * 2;
  const u16 = () => {
    const a = new Uint16Array(buf, o, n);
    o += n * 2;
    return a;
  };
  return { votes: new Int16Array(buf, 8, n), from: u16(), toStart: u16(), toEnd: u16() };
}
