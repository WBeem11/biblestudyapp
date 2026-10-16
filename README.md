# Bible Study

A deep Bible study app built on one rule: **Scripture interprets Scripture**. It never generates
summaries, advice or commentary. All study content comes from verified, local data
(see [`config/hermeneutics.ts`](config/hermeneutics.ts)).

- **Parallel Reader**: BSB and KJV side by side, verse-aligned, with cross-references for every verse.
- **Iconograph**: all 344,794 OpenBible.info cross-references drawn as arcs across the canon (D3 + Canvas).
- **Inline Concordance**: Hebrew and Greek word by word (STEPBible), with plain-English parsing and every occurrence.
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
| `npm run test:e2e` | Playwright flows plus axe accessibility scans (run `npm run build` first) |
| `npm run lint` / `npm run typecheck` | ESLint, including the hermeneutics guardrail rules / TypeScript |

## Deploy (Vercel)

`vercel.json` runs `npm run db:setup && npm run build`, so each deploy fetches the pinned sources,
verifies their checksums, and builds the database. `next.config.ts` bundles `data/bible.db` with the
server functions. Set `NEXT_PUBLIC_SITE_URL` to the production origin for the sitemap.

CI (`.github/workflows/ci.yml`) runs the same build, then lint, unit, end-to-end and accessibility tests.

## Data and licenses

BSB and KJV (public domain), OpenBible.info cross-references (CC BY) and STEPBible data
(CC BY 4.0, Tyndale House Cambridge). Full attributions are on the `/about` page. To update a source,
review the new upstream file, then update its pin and checksum in `scripts/data-manifest.ts`.

See [PLAN.md](PLAN.md) for the architecture and the decisions behind each phase.
