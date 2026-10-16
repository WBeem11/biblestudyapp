import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

// Canon structure ------------------------------------------------------------

export const books = sqliteTable(
  "books",
  {
    id: integer("id").primaryKey(), // 1..66
    osis: text("osis").notNull().unique(), // 'Gen', 'John'
    name: text("name").notNull(),
    testament: text("testament", { enum: ["OT", "NT"] }).notNull(),
    genre: text("genre").notNull(),
    chapters: integer("chapters").notNull(),
  },
  (t) => [check("books_testament", sql`${t.testament} IN ('OT','NT')`)],
);

/** One row per chapter. `ordinal` (1..1189) is the Iconograph's overview x-position. */
export const chapters = sqliteTable(
  "chapters",
  {
    ordinal: integer("ordinal").primaryKey(),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id),
    chapter: integer("chapter").notNull(),
    verseCount: integer("verse_count").notNull(),
  },
  (t) => [unique("chapters_book_chapter").on(t.bookId, t.chapter)],
);

export const verses = sqliteTable(
  "verses",
  {
    id: integer("id").primaryKey(), // BBCCCVVV
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id),
    chapter: integer("chapter").notNull(),
    verse: integer("verse").notNull(),
    ordinal: integer("ordinal").notNull().unique(), // canonical sequence (verse-level x-position)
  },
  (t) => [unique("verses_book_chapter_verse").on(t.bookId, t.chapter, t.verse)],
);

// Translations ---------------------------------------------------------------

export const translations = sqliteTable("translations", {
  id: text("id").primaryKey(), // 'BSB', 'KJV'
  name: text("name").notNull(),
  license: text("license").notNull(),
});

export const verseTexts = sqliteTable(
  "verse_texts",
  {
    verseId: integer("verse_id")
      .notNull()
      .references(() => verses.id),
    translationId: text("translation_id")
      .notNull()
      .references(() => translations.id),
    text: text("text").notNull(),
  },
  (t) => [primaryKey({ columns: [t.verseId, t.translationId] })],
);

// Cross-references -----------------------------------------------------------

/** Directed edges as published; the UI treats them as undirected. */
export const crossRefs = sqliteTable(
  "cross_refs",
  {
    id: integer("id").primaryKey(),
    fromVerse: integer("from_verse")
      .notNull()
      .references(() => verses.id),
    toVerseStart: integer("to_verse_start")
      .notNull()
      .references(() => verses.id),
    toVerseEnd: integer("to_verse_end")
      .notNull()
      .references(() => verses.id), // equals start for single verses
    votes: integer("votes").notNull().default(0),
    source: text("source").notNull().default("openbible"),
  },
  (t) => [
    index("idx_xref_from").on(t.fromVerse),
    index("idx_xref_to").on(t.toVerseStart),
  ],
);

/** Chapter-to-chapter aggregates for the Iconograph overview. from < to (undirected). */
export const chapterEdges = sqliteTable(
  "chapter_edges",
  {
    fromChapterOrd: integer("from_chapter_ord").notNull(),
    toChapterOrd: integer("to_chapter_ord").notNull(),
    refCount: integer("ref_count").notNull(),
    weight: integer("weight").notNull(), // sum of positive votes
  },
  (t) => [primaryKey({ columns: [t.fromChapterOrd, t.toChapterOrd] })],
);

// Original languages (populated in Phase 4) ----------------------------------

export const lemmas = sqliteTable(
  "lemmas",
  {
    strongs: text("strongs").primaryKey(), // STEPBible disambiguated Strong's ('H0430G', 'G0026')
    language: text("language", { enum: ["hbo", "arc", "grc"] }).notNull(),
    lemma: text("lemma").notNull(),
    translit: text("translit"),
    gloss: text("gloss"),
    definition: text("definition"), // plain text from TBESH/TBESG (BDB / Abbott-Smith based)
    morph: text("morph"), // brief part of speech, e.g. 'H:N-M'
    /** Occurrences in the base text (Hebrew OT + NA27/28 Greek NT). */
    occurrences: integer("occurrences").notNull().default(0),
  },
  (t) => [check("lemmas_language", sql`${t.language} IN ('hbo','arc','grc')`)],
);

export const words = sqliteTable(
  "words",
  {
    id: integer("id").primaryKey(),
    verseId: integer("verse_id")
      .notNull()
      .references(() => verses.id),
    position: integer("position").notNull(),
    surface: text("surface").notNull(),
    translit: text("translit"),
    language: text("language", { enum: ["hbo", "arc", "grc"] }).notNull(),
    /** Main lexical form (the braced dStrong in STEPBible data). */
    strongs: text("strongs").references(() => lemmas.strongs),
    /** All dStrongs including prefixes/suffixes, e.g. 'H9003/{H7225G}'. */
    strongsAll: text("strongs_all"),
    morph: text("morph"), // full code, e.g. 'HR/Ncfsa' or 'N-GSF'
    gloss: text("gloss"), // STEPBible contextual English gloss
    /** STEPBible text-type code (e.g. 'L', 'Q(K)', 'NKO', 'K'). */
    edition: text("edition").notNull(),
    /** 1 = part of the base text (Hebrew OT; NA27/28 for the NT); 0 = TR-only (KJV) word. */
    isBase: integer("is_base").notNull().default(1),
  },
  (t) => [
    unique("words_verse_position").on(t.verseId, t.position),
    index("idx_words_strongs").on(t.strongs, t.isBase),
  ],
);

/** Plain-English expansions of morphology codes (STEPBible TEHMC / TEGMC). */
export const morphCodes = sqliteTable("morph_codes", {
  code: text("code").primaryKey(), // 'HVqp3ms', 'HR', 'V-AAI-3S'
  description: text("description").notNull(),
});
