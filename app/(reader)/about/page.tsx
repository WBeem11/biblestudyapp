import Link from "next/link";
import { HERMENEUTICS } from "@/config/hermeneutics";

export const metadata = {
  title: "About & sources · Bible Study",
  description: "The hermeneutical principle of this app and the sources and licenses behind its data.",
};

const SOURCES: { name: string; use: string; license: string; href: string; note?: string }[] = [
  {
    name: "Berean Standard Bible (BSB)",
    use: "Primary English translation; search",
    license: "Public domain",
    href: "https://berean.bible",
  },
  {
    name: "King James Version (KJV)",
    use: "Parallel English translation; search",
    license: "Public domain",
    href: "https://github.com/scrollmapper/bible_databases",
    note: "Text via scrollmapper/bible_databases. In the United Kingdom the KJV remains under Crown patent.",
  },
  {
    name: "OpenBible.info Cross References",
    use: "Every arc in the Iconograph and every cross-reference, with community relevance votes",
    license: "CC BY",
    href: "https://www.openbible.info/labs/cross-references/",
  },
  {
    name: "STEPBible TAHOT: Translators Amalgamated Hebrew OT",
    use: "Hebrew and Aramaic text (Leningrad Codex), transliteration, glosses and parsing",
    license: "CC BY 4.0, Tyndale House Cambridge / STEPBible.org",
    href: "https://github.com/STEPBible/STEPBible-Data",
  },
  {
    name: "STEPBible TAGNT: Translators Amalgamated Greek NT",
    use: "Greek text (NA27/28 with Textus Receptus variants marked), transliteration, glosses and parsing",
    license: "CC BY 4.0, Tyndale House Cambridge / STEPBible.org",
    href: "https://github.com/STEPBible/STEPBible-Data",
    note: "English glosses are adapted from the Berean Study Bible, with permission (per STEPBible).",
  },
  {
    name: "STEPBible TBESH & TBESG brief lexicons",
    use: "Lexicon entries in the concordance (Hebrew based on Brown-Driver-Briggs; Greek from Abbott-Smith)",
    license: "CC BY 4.0, Tyndale House Cambridge / STEPBible.org",
    href: "https://github.com/STEPBible/STEPBible-Data",
  },
  {
    name: "STEPBible TEHMC & TEGMC morphology codes",
    use: "Plain-English parsing of every Hebrew and Greek word",
    license: "CC BY 4.0, Tyndale House Cambridge / STEPBible.org",
    href: "https://github.com/STEPBible/STEPBible-Data",
  },
];

const FONTS = ["EB Garamond", "Inter", "Noto Serif Hebrew", "Gentium Plus"];
const SOFTWARE = [
  ["Next.js", "MIT"],
  ["React", "MIT"],
  ["D3 (d3-zoom, d3-scale, d3-selection)", "ISC"],
  ["better-sqlite3", "MIT"],
  ["Drizzle ORM", "Apache-2.0"],
  ["Tailwind CSS", "MIT"],
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-14 sm:px-8">
      <p className="small-caps text-sm tracking-[0.12em] text-muted">{HERMENEUTICS.principle}</p>
      <h1 className="mt-3 font-serif text-5xl font-normal tracking-tight">About & sources</h1>

      <section className="mt-10 space-y-4 font-serif text-[1.1875rem] leading-[1.7]">
        <p>
          This app is built on one hermeneutical rule: <em>Scripture interprets Scripture</em>. Everything you read
          here is the text of the Bible itself, its cross-references, its original Hebrew and Greek words, and
          published lexicons.
        </p>
        <p>
          It never generates summaries, study advice, or commentary. No artificial intelligence writes any of the
          content. All study data comes from the verified, read-only sources listed below, and the app enforces this
          in code.
        </p>
      </section>

      <h2 className="small-caps mt-14 text-sm tracking-[0.12em] text-muted">Texts and data</h2>
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {SOURCES.map((s) => (
          <li key={s.name} className="py-4">
            <a href={s.href} className="font-serif text-lg hover:text-accent" rel="noreferrer">
              {s.name}
            </a>
            <p className="mt-0.5 text-sm text-muted">{s.use}</p>
            <p className="mt-1 text-xs tracking-wide text-accent">{s.license}</p>
            {s.note && <p className="mt-1 text-xs text-muted">{s.note}</p>}
          </li>
        ))}
      </ul>

      <h2 className="small-caps mt-12 text-sm tracking-[0.12em] text-muted">Typefaces</h2>
      <p className="mt-3 text-sm">
        {FONTS.join(", ")}. All are licensed under the SIL Open Font License 1.1 and served via Google Fonts.
      </p>

      <h2 className="small-caps mt-12 text-sm tracking-[0.12em] text-muted">Software</h2>
      <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
        {SOFTWARE.map(([name, license]) => (
          <li key={name} className="flex justify-between gap-4 border-b border-rule/60 py-1.5">
            <span>{name}</span>
            <span className="text-muted">{license}</span>
          </li>
        ))}
      </ul>

      <p className="mt-14 text-sm">
        <Link href="/read/john/1" className="text-accent hover:underline">
          Begin reading →
        </Link>
      </p>
    </div>
  );
}
