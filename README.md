# Bible Study

A deep Bible study app built on one rule: **Scripture interprets Scripture**. It never generates
summaries, advice or commentary. All study content comes from verified, local data
(see [`config/hermeneutics.ts`](config/hermeneutics.ts)).

- **Parallel Reader**: BSB and KJV side by side, verse-aligned, with cross-references for every verse.
- **Iconograph**: all 344,794 OpenBible.info cross-references drawn as arcs across the canon (D3 + Canvas).
- **Inline Concordance**: Hebrew and Greek word by word (STEPBible), with plain-English parsing and every occurrence.
- **Threads**: read a whole chapter while a thread from every verse runs to where it lands, Genesis to Revelation; select a verse to read everything it points to, grouped by book, without leaving the chapter.
- **Search**: full-text search with reference parsing (`⌘K`, then "Rom 8:28" or "loving devotion").

## Develop

```bash
npm install
npm run db:setup   # download + SHA-256-verify the pinned sources, then build data/bible.db (~10 s)
npm run dev
```

| Command | What it does |
|---|---|
| `npm run data:fetch` | Download the sources pinned in `scripts/data-manifest.ts` into `data/raw/`, verifying each checksum |
| `npm run db:build` | Build `data/bible.db` (SQLite, read-only at runtime) from `data/raw/` |
| `npm test` | Unit and data-validation tests (Vitest) |
| `npm run test:e2e` | Playwright flows plus axe accessibility scans (run `npm run build` first; `E2E_PORT=3100` if :3000 is busy) |
| `npm run lint` / `npm run typecheck` | ESLint, including the hermeneutics guardrail rules / TypeScript |

## Deploy (Vercel)

`vercel.json` runs `npm run db:setup && npm run build`, so each deploy fetches the pinned sources,
verifies their checksums, and builds the database. `next.config.ts` bundles `data/bible.db` with the
server functions. Set `NEXT_PUBLIC_SITE_URL` to the production origin for the sitemap.

The welcome gateway's email sign-up needs `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`; locally in `.env.local`). They are inlined at
build time, so redeploy after setting them. Without them the site builds and runs, and the gateway reports
that sign-up is unavailable.

CI (`.github/workflows/ci.yml`) runs the same build, then lint, unit, end-to-end and accessibility tests.

## Data and licenses

BSB and KJV (public domain), OpenBible.info cross-references (CC BY) and STEPBible data
(CC BY 4.0, Tyndale House Cambridge). Full attributions are on the `/about` page. To update a source,
review the new upstream file, then update its pin and checksum in `scripts/data-manifest.ts`.

See [PLAN.md](PLAN.md) for the architecture and the decisions behind each phase.
