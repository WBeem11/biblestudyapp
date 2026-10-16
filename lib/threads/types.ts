/** Wire format for a chapter's cross-reference threads. Client-safe. */

/** [verse number, toStart verse id, toEnd verse id, votes, canonical ordinal of toStart (1..31102)] */
export type ThreadRef = [number, number, number, number, number];

export interface ChapterThreads {
  /** Positive-vote cross-references from every verse of the chapter, strongest first within each verse. */
  refs: ThreadRef[];
  /** Canonical ordinal range of this chapter's own verses, for the "you are here" marker. */
  self: [number, number];
  /** First canonical verse ordinal of each book (index 0 = Genesis), for the rail's book bands. */
  bookStarts: number[];
}

export const TOTAL_VERSES = 31102;
