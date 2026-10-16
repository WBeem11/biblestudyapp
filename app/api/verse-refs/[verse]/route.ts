import { STATIC_DATA_HEADERS, badRequest } from "@/lib/api-response";
import { getVerseReferences } from "@/lib/queries/threads";
import { TRANSLATION_IDS } from "@/lib/reader/state";
import { bookById, decodeVerseId } from "@/lib/refs";

export async function GET(request: Request, { params }: RouteContext<"/api/verse-refs/[verse]">) {
  const { verse } = await params;
  const id = Number(verse);
  const { book, chapter, verse: v } = decodeVerseId(id);
  const b = bookById(book);
  if (!Number.isInteger(id) || !b || chapter < 1 || chapter > b.chapters || v < 1) return badRequest("Unknown verse", 404);
  const t = (new URL(request.url).searchParams.get("t") ?? "BSB").toUpperCase();
  if (!(TRANSLATION_IDS as readonly string[]).includes(t)) return badRequest("Unknown translation");
  return Response.json({ refs: getVerseReferences(id, t) }, { headers: STATIC_DATA_HEADERS });
}
