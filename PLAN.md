# Bible Study App — Development Plan

A deep Bible study app built around two core tools:

1. **Cross-Reference Iconograph**: an interactive arc diagram of every chapter in Scripture, with each cross-reference drawn as an arc between the passages it connects.
2. **Inline Concordance**: tap any word in the reader to see its original Hebrew/Greek lemma, morphology, gloss, and every other place that lemma appears.

Design system: **Minimalist Sacred UI**. Contemporary Christian modernism, premium book typography, stone and linen tones, generous whitespace.

---

## 1. Project Architecture

### Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Server Components can query SQLite directly; route-per-passage URLs (`/read/john/3`) |
| Styling | **Tailwind CSS** with design tokens in CSS variables | Tokens for the stone/linen palette and type scale; light and dark themes |
| Database | **SQLite** via **better-sqlite3** | Fast synchronous reads, a single file that ships with the app, read-only at runtime |
| Query layer | **Drizzle ORM** (schema + typed queries) | Typed schema, migrations, still close to raw SQL |
| Visualization | **D3** (scales, interpolation, zoom) + **HTML Canvas** rendering | SVG cannot handle ~340k arcs; Canvas can, with D3 doing the math |
| State | React state + URL search params; **Zustand** only if shared state grows | The selected verse, active ref, and panel state stay linkable |
| Data ingestion | Node scripts in `/scripts` (TSV/CSV → SQLite) | Repeatable, versioned ETL; the DB can be rebuilt from source files |
| Testing | **Vitest** (data and query layer), **Playwright** (reader flows) | |

### Data sources (all openly licensed; attribution page required)

- **Bible text:** Berean Standard Bible (public domain) and KJV (public domain). The schema supports more translations later.
- **Cross-references:** OpenBible.info cross-reference dataset (~340k edges with community vote weights, CC-BY).
- **Original languages:** STEPBible TAHOT (Hebrew OT) and TAGNT (Greek NT): word-level text with Strong's numbers, morphology, and glosses (CC-BY).
- **Lexicon:** STEPBible TBESH/TBESG brief lexicons (CC-BY).

### Directory layout

```
/app
  /(reader)/read/[book]/[chapter]/page.tsx   ← Parallel Reader
  /iconograph/page.tsx                       ← Full-screen arc view
  /api/...                                   ← Thin JSON routes for client fetches
/components
  /reader/        ParallelReader, VersePane, VerseLine, WordToken
  /iconograph/    ArcCanvas, ArcLegend, BookAxis, HoverCard
  /concordance/   ConcordancePopover, LemmaPanel, OccurrenceList
  /ui/            Design-system primitives (Button, Sheet, Divider, Kbd)
/lib
  /db/            client.ts (better-sqlite3 singleton), schema.ts (Drizzle)
  /queries/       verses.ts, crossrefs.ts, lexicon.ts
  /refs/          OSIS parsing/formatting, book metadata, verse-id math
/scripts          ingest-text.ts, ingest-crossrefs.ts, ingest-original.ts, build-db.ts
/data
  /raw/           Source TSV/CSV files (git-ignored or LFS)
  bible.db        Built database (read-only at runtime)
/styles           tokens.css, typography.css
```

### Verse ID convention

Each verse gets an integer ID `BBCCCVVV` (e.g. John 3:16 → `43003016`). Range queries become integer comparisons, and the Iconograph can place verses on its x-axis with no lookups.

### Data model (SQLite)

```sql
-- Canon structure
CREATE TABLE books (
  id          INTEGER PRIMARY KEY,      -- 1..66
  osis        TEXT NOT NULL UNIQUE,     -- 'Gen', 'John'
  name        TEXT NOT NULL,            -- 'Genesis'
  testament   TEXT NOT NULL CHECK (testament IN ('OT','NT')),
  genre       TEXT NOT NULL,            -- 'law','history','wisdom','prophets','gospels','epistles','apocalyptic'
  chapters    INTEGER NOT NULL
);

CREATE TABLE verses (
  id          INTEGER PRIMARY KEY,      -- BBCCCVVV
  book_id     INTEGER NOT NULL REFERENCES books(id),
  chapter     INTEGER NOT NULL,
  verse       INTEGER NOT NULL,
  ordinal     INTEGER NOT NULL UNIQUE,  -- 1..31102, canonical sequence (Iconograph x-position)
  UNIQUE (book_id, chapter, verse)
);

-- Translations and verse text
CREATE TABLE translations (
  id          TEXT PRIMARY KEY,         -- 'BSB', 'KJV'
  name        TEXT NOT NULL,
  license     TEXT NOT NULL
);

CREATE TABLE verse_texts (
  verse_id        INTEGER NOT NULL REFERENCES verses(id),
  translation_id  TEXT NOT NULL REFERENCES translations(id),
  text            TEXT NOT NULL,
  PRIMARY KEY (verse_id, translation_id)
) WITHOUT ROWID;

-- Cross-reference edges (directed; the UI treats them as undirected)
CREATE TABLE cross_refs (
  id            INTEGER PRIMARY KEY,
  from_verse    INTEGER NOT NULL REFERENCES verses(id),
  to_verse_start INTEGER NOT NULL REFERENCES verses(id),
  to_verse_end   INTEGER NOT NULL REFERENCES verses(id),  -- same as start for single verses
  votes         INTEGER NOT NULL DEFAULT 0,               -- OpenBible relevance weight
  source        TEXT NOT NULL DEFAULT 'openbible'
);
CREATE INDEX idx_xref_from ON cross_refs(from_verse);
CREATE INDEX idx_xref_to   ON cross_refs(to_verse_start);

-- Precomputed chapter-to-chapter aggregates for the Iconograph's overview level
CREATE TABLE chapter_edges (
  from_chapter_ord INTEGER NOT NULL,   -- 1..1189
  to_chapter_ord   INTEGER NOT NULL,
  weight           INTEGER NOT NULL,   -- sum of votes / count of refs
  PRIMARY KEY (from_chapter_ord, to_chapter_ord)
) WITHOUT ROWID;

-- Original-language layer (Phase 4 populates; created in Phase 1)
CREATE TABLE lemmas (
  strongs     TEXT PRIMARY KEY,        -- 'H0430', 'G0026'
  language    TEXT NOT NULL CHECK (language IN ('hbo','arc','grc')),
  lemma       TEXT NOT NULL,           -- אֱלֹהִים / ἀγάπη
  translit    TEXT,
  gloss       TEXT,
  definition  TEXT
);

CREATE TABLE words (
  id          INTEGER PRIMARY KEY,
  verse_id    INTEGER NOT NULL REFERENCES verses(id),
  position    INTEGER NOT NULL,        -- word order within the verse
  surface     TEXT NOT NULL,           -- inflected form as written
  strongs     TEXT REFERENCES lemmas(strongs),
  morph       TEXT,                    -- e.g. 'HNcmpa', 'V-AAI-3S'
  gloss       TEXT,                    -- contextual English gloss
  UNIQUE (verse_id, position)
);
CREATE INDEX idx_words_strongs ON words(strongs);

-- Full-text search over translations
CREATE VIRTUAL TABLE verse_fts USING fts5(text, content='verse_texts', tokenize='unicode61');
```

Phase 4 may add a `word_alignments` table (English token span ↔ original `words.id`) if the source data supports clean alignment. Without it, the concordance works from an "original-language interlinear" toggle instead of from English words.

### Design system: Minimalist Sacred UI

- **Palette (tokens):** `--linen` #F5F1EA (ground), `--parchment` #EDE6DA, `--stone-300` #CFC7BA, `--stone-500` #8C8476, `--ink` #2A2723, plus a single restrained accent, `--gilt` #A88B52, used for selection and arcs in focus. Dark theme: `--ink` ground with warm stone text.
- **Typography:** scripture set in a literary serif (EB Garamond or Cormorant Garamond), UI in a quiet humanist sans (Inter). Hebrew in Noto Serif Hebrew and Greek in Gentium Plus, all OFL-licensed. Text measure about 60–68ch, 1.7 line height, old-style figures for verse numbers.
- **Space and rhythm:** 8px base grid, wide margins, hairline (0.5px stone) dividers instead of boxes, no drop shadows; depth comes from tone.
- **Motion:** slow, eased fades (200–300ms). Nothing bounces. Users with `prefers-reduced-motion` get none.

---

## 2. Roadmap

### Phase 1: Foundation: Next.js, Tailwind, SQLite schema

**Goal:** an app that boots, reads from a real SQLite database, and renders one chapter as plain text.

- Scaffold Next.js (App Router, TypeScript, ESLint), Tailwind, and Prettier.
- Define design tokens (`tokens.css`) and wire them into the Tailwind theme; load fonts with `next/font`.
- Add `better-sqlite3` + Drizzle, define the full schema above (including the empty original-language tables), and generate migrations.
- Write `/lib/refs`: book metadata, OSIS parsing (`"John 3:16-18"` ↔ IDs), and `BBCCCVVV` math, with unit tests.
- Ingestion scripts: books → verses → BSB/KJV text → OpenBible cross-refs → `chapter_edges` aggregate → FTS index.
- One smoke route, `/read/john/3`, rendering the verse text unstyled from the DB.

**Done when:** `npm run db:build` produces `bible.db` from raw files, query-layer tests pass, and the smoke route renders John 3 from SQLite.

### Phase 2: Parallel Reader layout

**Goal:** a beautiful, focused reading experience with two translations side by side.

- Reader shell: book/chapter navigator (command-palette style, ⌘K), prev/next chapter, and a persistent URL state (`?t=BSB,KJV&v=16`).
- Parallel panes with verse-aligned rows, so verse 16 lines up across translations even when lengths differ. Panes stack into tabs on mobile.
- Verse selection: click a verse to highlight it and open a quiet side sheet listing its cross-references (text previews, sorted by votes).
- Type and layout polish against the design system: drop-cap chapter openings, small-caps headings, hanging verse numbers.
- Keyboard navigation and accessibility (focus rings in the gilt accent, semantic landmarks, screen-reader verse labels).

**Done when:** a user can navigate anywhere in Scripture, read two translations aligned by verse, and see a selected verse's cross-references, on desktop and at 400px.

### Phase 3: Cross-Reference Iconograph (D3 + Canvas arc component)

**Goal:** the signature visualization, isolated as a reusable `<ArcCanvas>` component.

- **Layout:** the x-axis spans 1,189 chapters in canonical order, with books marked by alternating stone tones and labels (`BookAxis`). Arcs are semicircles above the axis whose height is proportional to the distance between the two passages.
- **Rendering:** Canvas 2D with `devicePixelRatio` scaling. Arcs are drawn at low alpha so density reads as tone, and arc color is keyed to distance or genre in muted stone/gilt. D3 handles scales, `d3-zoom` handles pan and zoom, and arcs re-render in a `requestAnimationFrame` loop.
- **Levels of detail:** the overview draws `chapter_edges` with a vote threshold. Zooming into a book range loads verse-level edges for that window via an API route.
- **Interaction:** hit-testing with an offscreen color-pick buffer (each arc gets a unique RGB ID), so hover stays fast. Hovering highlights an arc in gilt and dims the rest, then shows a `HoverCard` with both passages' text. Clicking jumps the Reader to that passage.
- **Integration:** a compact Iconograph strip in the Reader shows the current chapter's arcs. The full-screen `/iconograph` route offers filters (testament, genre, minimum votes).
- **Performance budget:** 60fps pan and zoom on a mid-range laptop. Edge data is shipped as compact typed arrays (`Int32Array`), not JSON objects.

**Done when:** the full overview renders in under 1s, pan/zoom/hover are smooth, and clicking an arc navigates the Reader correctly.

### Phase 4: Inline Concordance

**Goal:** tap a word and see the Hebrew or Greek behind it.

- Ingest STEPBible TAHOT/TAGNT into `words`, and the lexicons into `lemmas`. Validate word counts per verse against the source.
- **Interlinear toggle** in the Reader: show the original-language text under (or beside) the English, with each word a `WordToken`.
- **ConcordancePopover** on a word: lemma in its native script, transliteration, gloss, parsed morphology in plain English ("Verb · Aorist · Active · Indicative · 3rd singular"), and occurrence count.
- **LemmaPanel:** every occurrence of the lemma, grouped by book with KWIC (keyword-in-context) snippets, plus a mini distribution bar across the canon in the Iconograph's visual language.
- English → original lookup via `word_alignments` if the data allows; otherwise via the interlinear row only. This decision is recorded at the start of the phase.
- RTL handling for Hebrew, with correct font fallback for vowel points and cantillation.

**Done when:** any word in the interlinear opens its lemma, occurrence lists are accurate against source counts, and the popover is keyboard-accessible.

### Phase 5: Integration, polish, and ship

**Goal:** connect the tools into one study flow and make the app production-ready.

- Cross-linking: the concordance distribution bar opens the Iconograph filtered to that lemma's verses, and an arc hover can show shared lemmas between the two passages.
- Full-text search (FTS5) with reference-aware parsing (typing "Rom 8" navigates; typing "steadfast love" searches).
- Dark theme pass, reduced-motion pass, Lighthouse and axe audits.
- Performance: static generation for chapter pages, caching for API routes, and a check on DB file size and bundling.
- Attribution/licenses page for every dataset and font.
- Deployment: a Node runtime host (Vercel with the read-only DB bundled, or Fly.io/Railway) and a CI job that rebuilds the DB and runs the tests.

**Done when:** the app is deployed, the core flows pass Playwright tests, and audits show no critical issues.

---

## 3. Decisions

1. **Translations:** BSB + KJV.
2. **Deployment target:** Vercel, with `data/bible.db` bundled through `outputFileTracingIncludes`.
3. **Package manager:** npm.

---

## 4. Progress log

### Phase 1: complete (2026-10-14)

- **Stack as built:** Next.js 16.4 (App Router, Cache Components, Turbopack), React 19.3, Tailwind 4, better-sqlite3 13, Drizzle ORM 0.45, Vitest 5. Next 16 has breaking changes from older docs; read `node_modules/next/dist/docs/` before using a new API (see `AGENTS.md`).
- **Commands:** `npm run db:build` (raw files → `data/bible.db`, about 2.5s, 46 MB), `npm test`, `npm run typecheck`, `npm run build`.
- **Raw data** in `data/raw/` (git-ignored): `bsb.txt` (bereanbible.com), `KJV.csv` (scrollmapper/bible_databases), `openbible/cross_references.txt` (from `cross-references.zip`, openbible.info).
- **Schema changes from the plan:**
  - Added a `chapters` table (ordinal 1..1189, verse count) for navigation and the Iconograph x-axis.
  - `chapter_edges` stores undirected pairs (`from < to`) with both `ref_count` and `weight` (sum of positive votes). Same-chapter refs are excluded.
  - FTS5 is an external-content index over `verse_texts`, created by a custom Drizzle migration (`0001_fts.sql`).
- **Data facts:**
  - The verse list comes from BSB: 31,102 verses.
  - BSB leaves 16 textual-variant verses blank (e.g. Matt 17:21). They keep their `verses` row but have no BSB text, and the reader shows them as omitted.
  - OpenBible: 344,794 refs imported and 5 rejected (they target 3 John 1:15, which BSB/KJV number as 1:14). That gives 142,082 chapter edges.
  - BSB renders *hesed* as "loving devotion". Remember this for search examples.
- **Smoke route:** `/read/[book]/[chapter]` renders two columns aligned by verse. `john/3` is prerendered and other chapters render on first request.

### Hermeneutical guardrail (2026-10-14)

`config/hermeneutics.ts` locks study content to Scripture, historic Reformed confessions, and hand-curated static modules. AI summaries, AI study advice and synthetic commentary are never allowed. It is enforced by:

- the DB build, which refuses any table not listed in `verifiedTables`;
- `lib/api.ts#getStudyData`, the only allowed client fetch path, which checks requests against the API-path allowlist;
- ESLint rules: no AI/LLM SDK imports, no DB client outside `lib/queries/`, no raw `fetch`/`window.fetch` in app, components or lib;
- `tests/hermeneutics.test.ts`, covering the config, the installed packages, the DB tables, a source scan, and lint probes.

To add confessions or curated modules (Desiring God / TGC citations), add the table to `verifiedTables` first. Curated modules store citations and links only, never copied article text.

### Phase 2: complete (2026-10-14)

- **Reader:** `/read/[book]/[chapter]` prerenders all 1,189 chapters (about 11s build). Verse rows are CSS subgrid rows, so translations align verse by verse.
  - With two translations, narrow screens switch to tabs.
  - With one translation, the text is capped at about 65ch.
- **URL state:** `?t=BSB,KJV&v=16` (`lib/reader/state.ts`), updated with `history.replaceState`.
  - The URL-bound reader sits inside `<Suspense>`, with the default-state reader as the fallback, so the prerendered HTML always carries the chapter text.
- **Cross-references:**
  - Selecting a verse opens `CrossRefSheet`: a sticky right column on desktop (lg and up) and a bottom sheet below that.
  - Data comes from `/api/crossrefs/[verse]`, ranked by votes, with text previews in the primary translation capped at 4 verses.
  - A gilt dot in the verse gutter shows each verse's cross-reference density.
- **Navigator:** ⌘K or `/` opens a native `<dialog>` combobox with a book grid, then a chapter grid. It parses typed references ("rom 8:28") and keeps the `t` param.
- **Keyboard:** j/k move between verses, Esc clears the selection, ←/→ change chapter (crossing book boundaries).
- **Typography:** drop cap on verse 1, small caps for LORD/GOD (skipped inside all-caps inscriptions), old-style verse numerals, hairline rules, and gilt focus rings.
- **Routing:**
  - `proxy.ts` 308-redirects aliases (`/read/jn/3` to `/read/john/3`) and returns a real 404 for invalid books or chapters.
  - It's needed because with Cache Components a page outside `generateStaticParams` streams its shell first, and `dynamicParams` is unavailable.
- **Naming:** `BookMeta.refName` gives "Psalm 23" for chapters and verses, while the book is still listed as "Psalms".
- **Activity:** Next keeps up to 3 previously visited pages mounted but hidden. Global key listeners live in effects, so they detach while a page is hidden. The navigator closes in a layout-effect cleanup.
- **Deferred to later phases:** incoming cross-references (only outgoing OpenBible edges are shown) and the Iconograph strip in the reader (Phase 3).

### Phase 3: complete (2026-10-14)

- **Routes:**
  - `/iconograph` is the full-screen arc diagram, with URL state: `?pct=` strongest %, `tm=` all/bridges/ot/nt, `g=` genre, `focus=john-3`.
  - The reader shows a 72px strip of the current chapter's arcs, loaded on scroll. Clicking it opens `/iconograph?focus=…`.
- **Data:**
  - `/api/iconograph/overview` serves all 142,082 chapter edges plus verse counts as typed arrays (format in `lib/iconograph/format.ts`). Over the wire it's 304 KB brotli / 372 KB gzip, down from 1.4 MB raw. It's compressed in `lib/api-response.ts` because Next doesn't compress `application/octet-stream`.
  - `/api/iconograph/edges?lo&hi` serves verse-level edges for a window of up to 159 chapters.
  - `/api/iconograph/pair/[a]/[b]` and `/api/passages` supply hover-card text.
  - All four paths are allow-listed in `config/hermeneutics.ts` and read only from verified tables.
- **Rendering** (`lib/iconograph/render.ts`): Canvas 2D, one stroke per arc, weakest first at low alpha, so density reads as tone.
  - Arcs within a Testament are ink and arcs between the Testaments are gilt.
  - Arcs are half-ellipses whose height is proportional to their on-screen span (`yScale` flattens them only when the canon's widest arc doesn't fit).
- **Zoom** (d3-zoom, horizontal only, up to 1500×): because the drawing scales uniformly about the baseline, a gesture shows the last full render as a scaled bitmap (geometrically exact). A crisp re-render runs 140ms after the gesture settles, or live while full renders stay under 10ms.
- **Level of detail:** below 120 visible chapters it switches to verse-level arcs for a padded window.
- **Hit-testing:** geometric (pointer distance to each drawn ellipse) instead of the planned color-pick buffer, because canvas anti-aliasing blends pick colors at arc edges. It's exact and takes about 1ms per pointer move.
- **Interaction:**
  - Hovering an arc dims the rest and shows a hover card with both passages' text.
  - Hovering the axis highlights that chapter's links.
  - Clicking an arc opens the reader at the end nearer the pointer, at verse level with `?v=`. Clicking the axis opens that chapter.
  - Keyboard: `+`/`−`, ←/→, `0`.
- **Strength filter:** "strongest N%". Both arc sets arrive sorted by strength, so one control means the same thing at chapter and verse level.
- **Measured** (1440×900, local production build):
  - First overview render about 80ms after navigation.
  - A full render of about 28k chapter arcs takes 10–11ms, and verse-level renders take 3–4ms.
  - The strip renders in 6ms.
  - A 159-chapter verse window is 569 KB raw and loads in about 180ms.
- **Accessibility:** the canvas wrapper is focusable with `role="img"` and a usage label. Arc-level information is pointer-only for now; the reader's cross-reference sheet is the accessible route to the same data.

### Phase 4: complete (2026-10-14)

- **Data:** STEPBible (CC BY 4.0) in `data/raw/stepbible/`, ingested by `scripts/ingest-original.ts`:
  - Words: TAHOT (Hebrew OT) and TAGNT (Greek NT).
  - Lexicons: TBESH and TBESG brief lexicons. The Greek is based on Abbott-Smith and the Hebrew on Brown-Driver-Briggs; these are published lexicon text, not generated.
  - Parsing: TEHMC and TEGMC morphology-code expansions.
- **New tables:** `words` gains translit, language, strongs_all, edition and is_base. `lemmas` gains morph and occurrences. New `morph_codes` table, registered in `config/hermeneutics.ts` as kind "scripture". The migrations were regenerated as one clean `0000_init.sql`, since the database is always rebuilt from scratch.
- **Base text:**
  - Hebrew: all TAHOT rows (Leningrad plus Qere, restorations, LXX additions). The 14 rows where the Qere omits a word are skipped.
  - Greek: NA27/28 words (`N`/`n`) are the base. KJV/Textus Receptus-only words (`K`/`k`) are stored with `is_base = 0` and shown dimmed with a "TR" mark. Words found only in other editions (`O`) are left out.
- **Versification:** TAGNT's primary numbering is NRSV, with `[…]` KJV, `(…)` NA and `{…}` other editions. Ingest keys on the `[KJV]` number when present, because our verses follow KJV/BSB numbering. TAHOT `(…)` gives the Hebrew number, and the English number is primary. Psalm titles (verse 0) fold into verse 1. A row that looks like data but doesn't parse fails the build.
- **Unicode:** source text is normalized to NFC at ingest. The data mixes canonically equivalent encodings, such as Greek oxia U+1F71 versus tonos U+03AC.
- **Validation** (`tests/concordance-data.test.ts`):
  - Every verse has words.
  - Gen 1:1 has 7 words, John 1:1 has 17 and John 3:16 has 25.
  - ἀγάπη 116, ἀγαπάω 143 and χάρις 155 match published NA28 counts; λόγος is 329, against 330 in NA28.
  - The Greek base text is 137,646 words; Hebrew/Aramaic is 305,634.
  - Every tagged word resolves to a lexicon entry. Tags with a missing or extra disambiguation letter fall back to the lexicon's first entry for that Strong's number.
- **Alignment decision:** STEPBible supplies a contextual English gloss for each original-language word, but no alignment to BSB or KJV wording, so lookup works from the interlinear row and English words aren't clickable. BSB's own interlinear tables (bereanbible.com) would make English-to-original lookup possible later.
- **Reader:**
  - A "Hebrew"/"Greek" toggle (`?i=1`) loads `/api/interlinear/[bookId]/[chapter]` on demand, so static pages stay lean, and renders each verse word by word (form, transliteration, gloss). Hebrew is right-to-left in Noto Serif Hebrew and Greek is in Gentium Plus.
  - Clicking a word opens `WordPopover`: lemma, gloss, form, contextual gloss, plain-English parsing (`lib/concordance/morph.ts`, e.g. "Verb · Aorist · Active · Indicative · 3rd person · Singular") and occurrence count.
  - "See all" opens `LemmaPanel` (`?l=G0026`) with:
    - a distribution chart across the canon (book width proportional to chapters, bar height to occurrences per chapter); clicking a bar filters to that book, and the bars are keyboard-accessible;
    - other STEPBible senses of the same Strong's number;
    - the lexicon entry, collapsible, with its source;
    - occurrences in canonical order, grouped by book, each with original-language context and the verse in the primary translation, 60 per page.
  - Clicking an occurrence opens that verse with the interlinear on and the panel still open; the lemma's words are highlighted in the interlinear.
  - Escape closes in layers: popover, then lemma panel, then verse selection. Focus moves into the popover and returns to the word.
- **APIs** (allow-listed): `/api/interlinear/[book]/[chapter]`, `/api/lemmas/[strongs]`, `/api/lemmas/[strongs]/occurrences?t&offset&limit&book`.
- **Database size:** now 106 MB (words 35 MB, cross_refs 11 MB). That's within Vercel's 250 MB function limit, but worth watching in Phase 5.

### Phase 5: complete except the deploy itself (2026-10-14)

- **Search:**
  - `/api/search` uses FTS5 in canonical order, with snippets and per-book counts.
  - `toFtsQuery` double-quotes every term, so FTS syntax in user input is inert; quoted phrases stay phrases.
  - ⌘K shows a reference "Go to" first, then books, then the first 5 verse matches (prefix match as you type) and "See all".
  - The `/search` page has a distribution chart and a book filter.
- **Cross-links:**
  - The concordance panel links to `/iconograph?lemma=G0026`, which highlights arcs between chapters that both use the word and marks those chapters on the axis.
  - Iconograph hover cards list shared rare Hebrew/Greek words (`/api/shared-lemmas`, occurrences ≤ 1,200, excluding particles). Arcs between the Testaments show none, since the languages differ.
- **Pages:** `/about` (hermeneutical statement plus every source, license and font), a home page with four entry points, a footer, `sitemap.xml` (1,193 URLs) and `robots.txt` (`/api/` disallowed).
- **Reproducible data:**
  - `scripts/data-manifest.ts` pins all 13 sources: STEPBible and KJV by commit SHA, and every file by SHA-256.
  - `npm run data:fetch` refuses any file whose checksum differs, so the deployed database can only contain reviewed texts.
  - A clean-room fetch reproduced the ingested bytes exactly, in 12 s.
- **Deploy configuration:**
  - `vercel.json` sets `buildCommand: npm run db:setup && npm run build`, and `engines.node` is 22.x.
  - Committing the database isn't an option, because 106 MB is over GitHub's 100 MB file limit.
  - `.github/workflows/ci.yml` runs data and database setup, lint, unit tests, build, typecheck, then Playwright (Chromium) with the report uploaded on failure.
- **Accessibility:**
  - Light-mode muted text deepened to `#6B6458` (5.2:1). Text accents use bronze `#7F6129` (5.1:1), and the original gilt is kept as `--accent-graphic` for arcs and bars.
  - Opacity on muted text removed.
  - TR-only words are marked with a dashed outline instead of reduced opacity.
  - Interlinear word buttons use their visible text as the accessible name.
- **Bugs found by tests:**
  - Rapid `j` key repeats read a stale verse, because the URL state updates asynchronously; the selection is now tracked in a ref.
  - The word popover closed on any scroll, including layout shifts from font loading; it now follows its word and closes only when the word leaves the screen.
- **Performance:**
  - The Iconograph header renders on the server (LCP 4.7 s → 2.4 s, Performance 83 → 98).
  - Interlinear placeholders reserve space while words load (CLS 0.161 → 0.003).
  - The search page has a stable minimum height (CLS 0.108 → 0.08).
  - Overview brotli quality is 9 (130 ms cold, 2 ms warm), down from 11 (about 1.4 s cold).
- **Lighthouse** (simulated slow 4G, production build): Accessibility, Best Practices and SEO are 100 on every audited page; Performance is 90–98 (`/` 96, `/read/john/3?i=1` 98, `/iconograph` 98, `/read/genesis/1?i=1` 98, `/search` 92).
- **Tests:** 58 unit and data tests. 47 Playwright tests across desktop and mobile: reader, keyboard, redirects/404, ⌘K, search, Iconograph, concordance, and axe (WCAG 2.1 AA) on 8 pages in light and dark mode. All passed across repeated runs.
- **Not done yet:** a git repository and the first Vercel deploy. Both need the owner's GitHub/Vercel accounts.

### Threads view (2026-10-15)

- **What it does:** a "Threads" toggle in the reader (`?th=1`) draws each verse's cross-references as ticks along its own Genesis→Revelation rail.
  - On wide screens (xl, with no side panel open) the rail sits in a column beside the text. Otherwise it's a full-width row under the verse.
  - Tick height reflects votes. A shaded band marks the current chapter, with book bands below.
  - Ticks are gold when three or more verses of the chapter reach the same target chapter.
- **Reading in place:**
  - Hovering a tick shows the passage's text, its votes and how many verses of this chapter reach that passage, and lights up the matching ticks in every other verse's rail.
  - Clicking (or tapping on a phone) pins the passage under the verse, so you can read it without leaving the chapter; any number of pins, each with unpin and an open link.
- **Accessibility:** each rail is `role="img"` with a summary (count and three strongest references), and its count button opens the full cross-reference list for that verse.
- **Data:** `/api/threads/[book]/[chapter]` returns every positive-vote reference from the chapter in one payload: at most 2,074 per chapter, 96 per verse. Zero- or negative-vote references, which OpenBible voters dispute, are left out of the rails but stay in the per-verse sheet. Allow-listed in `config/hermeneutics.ts`.
- **Tests:** unit coverage for the query and the `th` parameter. Playwright covers toggle, hover, pin and unpin while staying on the chapter, and the accessible list. axe runs on `/read/john/3?th=1` in light and dark mode at desktop and phone widths. `E2E_PORT` lets the suite run beside a dev server on :3000.
