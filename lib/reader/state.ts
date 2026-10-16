/** Reader URL state: `?t=BSB,KJV&v=16&i=1&l=G0026`. Client-safe (no DB imports). */

export const TRANSLATION_IDS = ["BSB", "KJV"] as const;
export type TranslationId = (typeof TRANSLATION_IDS)[number];
export const DEFAULT_TRANSLATIONS: TranslationId[] = ["BSB", "KJV"];

export interface ReaderState {
  translations: TranslationId[]; // ordered, 1..n, no duplicates
  verse: number | null; // selected verse number within the chapter
  interlinear: boolean; // show the Hebrew/Greek interlinear under each verse
  lemma: string | null; // open concordance panel for this lemma (STEPBible dStrong)
}

export const DEFAULT_STATE: ReaderState = { translations: DEFAULT_TRANSLATIONS, verse: null, interlinear: false, lemma: null };

const LEMMA_KEY = /^[HG]\d{4}[A-Za-z]?$/;

function isTranslation(s: string): s is TranslationId {
  return (TRANSLATION_IDS as readonly string[]).includes(s);
}

export function parseReaderState(params: URLSearchParams, verseCount: number): ReaderState {
  const t = (params.get("t") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(isTranslation);
  const translations = [...new Set(t)];
  const v = Number(params.get("v"));
  const l = params.get("l");
  return {
    translations: translations.length ? translations : DEFAULT_TRANSLATIONS,
    verse: Number.isInteger(v) && v >= 1 && v <= verseCount ? v : null,
    interlinear: params.get("i") === "1",
    lemma: l && LEMMA_KEY.test(l) ? l : null,
  };
}

/** Query string for a state, omitting defaults. Includes the leading "?" when non-empty. */
export function readerQuery(state: Partial<ReaderState>): string {
  const p = new URLSearchParams();
  const t = state.translations;
  if (t && t.join(",") !== DEFAULT_TRANSLATIONS.join(",")) p.set("t", t.join(","));
  if (state.verse) p.set("v", String(state.verse));
  if (state.interlinear) p.set("i", "1");
  if (state.lemma) p.set("l", state.lemma);
  const s = p.toString();
  return s ? `?${s}` : "";
}
