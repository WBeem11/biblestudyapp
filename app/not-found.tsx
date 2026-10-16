import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-24">
      <p className="small-caps text-sm tracking-[0.12em] text-muted">Not found</p>
      <h1 className="mt-3 font-serif text-4xl">This passage isn’t here.</h1>
      <p className="mt-4 text-muted">The book or chapter in this address doesn’t exist.</p>
      <Link href="/read/john/1" className="mt-10 self-start border-b border-accent pb-0.5 text-accent">
        Go to John 1 →
      </Link>
    </main>
  );
}
