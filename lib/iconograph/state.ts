/** Iconograph URL state: `?pct=20&tm=bridges&g=gospels&focus=john-3&lemma=G0026`. Client-safe. */
import { chapterOrdinal, findBook, type Genre } from "@/lib/refs";
import { DEFAULT_FILTERS, GENRES, type ArcFilters, type TestamentFilter } from "./model";

const TESTAMENTS: TestamentFilter[] = ["all", "bridges", "ot", "nt"];

export interface IconographState {
  filters: ArcFilters;
  focus: { slug: string; chapter: number; ordinal: number } | null;
  /** Highlight arcs between chapters that both use this lemma (STEPBible dStrong). */
  lemma: string | null;
}

export function parseFocus(s: string | null): IconographState["focus"] {
  const m = s?.match(/^(.+)-(\d+)$/);
  const book = m ? findBook(m[1]) : undefined;
  const chapter = m ? Number(m[2]) : 0;
  if (!book || chapter < 1 || chapter > book.chapters) return null;
  return { slug: book.slug, chapter, ordinal: chapterOrdinal(book.id, chapter) };
}

export function parseIconographState(p: URLSearchParams): IconographState {
  const pct = Number(p.get("pct"));
  const tm = p.get("tm") as TestamentFilter;
  const g = p.get("g") as Genre;
  return {
    filters: {
      strongestPct: Number.isInteger(pct) && pct >= 1 && pct <= 100 ? pct : DEFAULT_FILTERS.strongestPct,
      testament: TESTAMENTS.includes(tm) ? tm : DEFAULT_FILTERS.testament,
      genre: GENRES.includes(g) ? g : "all",
    },
    focus: parseFocus(p.get("focus")),
    lemma: /^[HG]\d{4}[A-Za-z]?$/.test(p.get("lemma") ?? "") ? p.get("lemma") : null,
  };
}

export function iconographQuery(s: IconographState, keep?: URLSearchParams): string {
  const p = new URLSearchParams();
  const t = keep?.get("t");
  if (t) p.set("t", t);
  if (s.filters.strongestPct !== DEFAULT_FILTERS.strongestPct) p.set("pct", String(s.filters.strongestPct));
  if (s.filters.testament !== "all") p.set("tm", s.filters.testament);
  if (s.filters.genre !== "all") p.set("g", s.filters.genre);
  if (s.focus) p.set("focus", `${s.focus.slug}-${s.focus.chapter}`);
  if (s.lemma) p.set("lemma", s.lemma);
  const q = p.toString();
  return q ? `?${q}` : "";
}
