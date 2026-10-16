/** Shared vertical canon geometry for the threads canvas and axis. Client-safe. */
import { TOTAL_VERSES } from "./types";

export const AXIS_PAD = 14;

/** y of a verse's center on an axis `h` px tall. */
export const yOfVerse = (ordinal: number, h: number) => AXIS_PAD + ((h - 2 * AXIS_PAD) * (ordinal - 0.5)) / TOTAL_VERSES;

/** y of the top edge of a verse (for book boundaries). */
export const yEdge = (ordinal: number, h: number) => AXIS_PAD + ((h - 2 * AXIS_PAD) * (ordinal - 1)) / TOTAL_VERSES;

/** Book index (0..65) at a y position. */
export function bookAtY(y: number, h: number, bookStarts: number[]): number {
  const ord = ((y - AXIS_PAD) / (h - 2 * AXIS_PAD)) * TOTAL_VERSES + 1;
  let lo = 0;
  let hi = bookStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (bookStarts[mid] <= ord) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
