import { NextResponse, type NextRequest } from "next/server";
import { findBook } from "@/lib/refs";

/**
 * Canonicalize reader URLs before rendering. With Cache Components, a chapter page outside
 * generateStaticParams streams its shell first, so a redirect/notFound thrown in the page
 * can't set the HTTP status. Here we can:
 *   /read/jn/3       → 308 /read/john/3
 *   /read/john/99    → 404
 */
export function proxy(request: NextRequest) {
  const [, , bookParam, chapterParam] = request.nextUrl.pathname.split("/");
  const book = findBook(decodeURIComponent(bookParam));
  const chapter = Number(chapterParam);

  if (!book || !/^\d+$/.test(chapterParam) || chapter < 1 || chapter > book.chapters) {
    // Rewrite to a path no route matches, which renders app/not-found with a 404 status.
    return NextResponse.rewrite(new URL("/__not-found", request.url));
  }
  if (bookParam !== book.slug || chapterParam !== String(chapter)) {
    const url = request.nextUrl.clone();
    url.pathname = `/read/${book.slug}/${chapter}`;
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/read/:book/:chapter",
};
