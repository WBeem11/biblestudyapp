import type { MetadataRoute } from "next";
import { BOOKS } from "@/lib/refs";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/iconograph", "/search", "/about"].map((p) => ({ url: `${SITE_URL}${p}` }));
  const chapters = BOOKS.flatMap((b) =>
    Array.from({ length: b.chapters }, (_, i) => ({ url: `${SITE_URL}/read/${b.slug}/${i + 1}` })),
  );
  return [...pages, ...chapters];
}
