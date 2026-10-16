import { getCrossRefPreviews } from "@/lib/queries/crossrefs";
import { TRANSLATION_IDS } from "@/lib/reader/state";
import { decodeVerseId, bookById } from "@/lib/refs";

export async function GET(request: Request, { params }: RouteContext<"/api/crossrefs/[verse]">) {
  const { verse } = await params;
  const id = Number(verse);
  const { book, chapter, verse: v } = decodeVerseId(id);
  const b = bookById(book);
  if (!Number.isInteger(id) || !b || chapter < 1 || chapter > b.chapters || v < 1) {
    return Response.json({ error: "Unknown verse" }, { status: 404 });
  }

  const url = new URL(request.url);
  const t = (url.searchParams.get("t") ?? "BSB").toUpperCase();
  if (!(TRANSLATION_IDS as readonly string[]).includes(t)) {
    return Response.json({ error: "Unknown translation" }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 500);

  return Response.json(getCrossRefPreviews(id, t, limit), {
    // The data only changes when the database is rebuilt, which ships with a deploy.
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
