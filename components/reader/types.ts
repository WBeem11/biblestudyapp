import type { ChapterVerse } from "@/lib/queries/verses";
import type { TranslationId } from "@/lib/reader/state";

export type { ChapterVerse };

export interface ChapterLink {
  href: string; // path only; the reader appends its query
  label: string;
}

export interface ReaderProps {
  book: { id: number; name: string; refName: string; slug: string; testament: "OT" | "NT"; genre: string };
  chapter: number;
  verses: ChapterVerse[];
  translations: { id: TranslationId; name: string }[];
  prev: ChapterLink | null;
  next: ChapterLink | null;
}
