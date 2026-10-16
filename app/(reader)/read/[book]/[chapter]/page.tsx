import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { ParallelReader } from "@/components/reader/ParallelReader";
import { ReaderWithUrl } from "@/components/reader/ReaderWithUrl";
import type { ReaderProps } from "@/components/reader/types";
import { getChapter, listTranslations } from "@/lib/queries/verses";
import { DEFAULT_STATE, TRANSLATION_IDS, type TranslationId } from "@/lib/reader/state";
import { BOOKS, adjacentChapter, findBook } from "@/lib/refs";

// Every chapter is static: prerender all 1,189.
export function generateStaticParams() {
  return BOOKS.flatMap((b) => Array.from({ length: b.chapters }, (_, i) => ({ book: b.slug, chapter: String(i + 1) })));
}

function resolve(bookParam: string, chapterParam: string) {
  const book = findBook(decodeURIComponent(bookParam));
  const chapter = Number(chapterParam);
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) notFound();
  return { book, chapter };
}

export async function generateMetadata({ params }: PageProps<"/read/[book]/[chapter]">) {
  const { book, chapter } = await params;
  const b = findBook(decodeURIComponent(book));
  return { title: b ? `${b.refName} ${chapter} · Bible Study` : "Bible Study" };
}

export default async function ChapterPage({ params }: PageProps<"/read/[book]/[chapter]">) {
  const { book: bookParam, chapter: chapterParam } = await params;
  const { book, chapter } = resolve(bookParam, chapterParam);
  // Abbreviations work (/read/jn/3) but the canonical URL uses the slug.
  if (bookParam !== book.slug || chapterParam !== String(chapter)) permanentRedirect(`/read/${book.slug}/${chapter}`);

  const link = (dir: 1 | -1) => {
    const a = adjacentChapter(book.id, chapter, dir);
    return a ? { href: `/read/${a.book.slug}/${a.chapter}`, label: `${a.book.refName} ${a.chapter}` } : null;
  };

  const props: ReaderProps = {
    book: { id: book.id, name: book.name, refName: book.refName, slug: book.slug, testament: book.testament, genre: book.genre },
    chapter,
    verses: getChapter(book.id, chapter, [...TRANSLATION_IDS]),
    translations: listTranslations()
      .filter((t): t is typeof t & { id: TranslationId } => (TRANSLATION_IDS as readonly string[]).includes(t.id))
      .map(({ id, name }) => ({ id, name })),
    prev: link(-1),
    next: link(1),
  };

  // The fallback is the full chapter in default view, so the prerendered HTML always carries the text;
  // the URL-bound reader (?t=, ?v=) replaces it on the client.
  return (
    <Suspense fallback={<ParallelReader {...props} state={DEFAULT_STATE} />}>
      <ReaderWithUrl {...props} />
    </Suspense>
  );
}
