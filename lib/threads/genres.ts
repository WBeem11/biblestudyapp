import { BOOKS, type Genre } from "@/lib/refs";

/** Canonical genre order: also the categorical color order (see styles/tokens.css). */
export const GENRES: Genre[] = ["law", "history", "wisdom", "prophets", "gospels", "acts", "epistles", "apocalyptic"];

export const GENRE_NAME: Record<Genre, string> = {
  law: "Law",
  history: "History",
  wisdom: "Wisdom",
  prophets: "Prophets",
  gospels: "Gospels",
  acts: "Acts",
  epistles: "Epistles",
  apocalyptic: "Revelation",
};

export const genreVar = (g: Genre) => `var(--genre-${g})`;

/** Genre of a verse id (BBCCCVVV). */
export const genreOfVerse = (verseId: number): Genre => BOOKS[Math.floor(verseId / 1_000_000) - 1].genre;

/** Resolved genre colors for canvas drawing (canvas can't read CSS variables). */
export function readGenreColors(el: Element): Record<Genre, string> {
  const cs = getComputedStyle(el);
  return Object.fromEntries(GENRES.map((g) => [g, cs.getPropertyValue(`--genre-${g}`).trim()])) as Record<Genre, string>;
}
