import Link from "next/link";

const ENTRIES = [
  { href: "/read/john/1", title: "Read", body: "BSB and KJV side by side, verse by verse, with every cross-reference one click away." },
  { href: "/iconograph", title: "Iconograph", body: "All 344,000 cross-references in the Bible, drawn as arcs from Genesis to Revelation." },
  { href: "/read/genesis/1?i=1", title: "Hebrew & Greek", body: "The original text word by word, with parsing and a concordance for every word." },
  { href: "/search", title: "Search", body: "Find any word or phrase across every verse." },
];

/** The app workspace: where the gateway leads. */
export function Hub() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-20 sm:px-8">
      <p className="small-caps text-sm tracking-[0.12em] text-muted">Scriptura sui ipsius interpres</p>
      <h1 className="mt-3 font-serif text-5xl font-normal tracking-tight sm:text-6xl">Bible Study</h1>
      <p className="mt-5 max-w-lg font-serif text-xl leading-relaxed text-text/90">
        Scripture interprets Scripture. Read it in parallel, follow its cross-references, and study its words in the
        original languages.
      </p>
      <ul className="mt-12 grid gap-px overflow-hidden rounded-md border border-rule bg-rule sm:grid-cols-2">
        {ENTRIES.map((e) => (
          <li key={e.href} className="bg-ground">
            <Link href={e.href} className="group block h-full p-6 transition-colors hover:bg-surface">
              <span className="font-serif text-2xl group-hover:text-accent">{e.title}</span>
              <span className="mt-2 block text-sm leading-relaxed text-muted">{e.body}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">
        Press <kbd>⌘K</kbd> anywhere to go to a passage or search.
      </p>
    </div>
  );
}
