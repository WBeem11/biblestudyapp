/** Wire types for the concordance APIs. Client-safe. */

export interface InterlinearWord {
  v: number; // verse number
  p: number; // position within the verse
  s: string; // surface form as written
  t: string | null; // transliteration
  g: string | null; // contextual English gloss
  k: string | null; // lemma key (STEPBible dStrong)
  m: string | null; // morphology code
  b: 0 | 1; // 1 = base text, 0 = KJV/TR-only word
}

export interface InterlinearChapter {
  language: "hbo" | "grc"; // dominant script for the chapter (Aramaic shares Hebrew script)
  words: InterlinearWord[];
  /** Morphology segment code → expansion ("Function=Noun; Gender=Masculine; …"). */
  morph: Record<string, string>;
  /** Lemma key → [lemma, gloss, occurrences] for words in this chapter. */
  lemmas: Record<string, [string, string | null, number]>;
}

export interface LemmaDetail {
  strongs: string;
  language: "hbo" | "arc" | "grc";
  lemma: string;
  translit: string | null;
  gloss: string | null;
  definition: string | null;
  morph: string | null;
  occurrences: number;
  /** Base-text occurrences per book (index 0 = Genesis … 65 = Revelation). */
  byBook: number[];
  /** Chapter ordinals (1..1189) where the lemma occurs in the base text. */
  chapters: number[];
  /** Other senses of the same Strong's number (STEPBible disambiguations). */
  siblings: { strongs: string; gloss: string | null; occurrences: number }[];
}

export interface SharedLemma {
  strongs: string;
  lemma: string;
  gloss: string | null;
  occurrences: number;
}

export interface Occurrence {
  verseId: number;
  position: number;
  surface: string;
  gloss: string | null;
  /** Original-language context: words before and after (base text). */
  before: string[];
  after: string[];
  text: string; // the verse in the requested translation
}

export interface OccurrencePage {
  total: number;
  offset: number;
  items: Occurrence[];
}
