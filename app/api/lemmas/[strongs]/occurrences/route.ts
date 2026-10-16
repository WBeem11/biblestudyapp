import { STATIC_DATA_HEADERS, badRequest } from "@/lib/api-response";
import { getOccurrences } from "@/lib/queries/concordance";
import { TRANSLATION_IDS } from "@/lib/reader/state";

export async function GET(request: Request, { params }: RouteContext<"/api/lemmas/[strongs]/occurrences">) {
  const { strongs } = await params;
  const p = new URL(request.url).searchParams;
  const t = (p.get("t") ?? "BSB").toUpperCase();
  const offset = Number(p.get("offset") ?? 0);
  const limit = Number(p.get("limit") ?? 100);
  const book = p.has("book") ? Number(p.get("book")) : undefined;
  if (!/^[HG]\d{4}[A-Za-z]?$/.test(strongs)) return badRequest("Expected a Strong's key like H7225G or G0026");
  if (!(TRANSLATION_IDS as readonly string[]).includes(t)) return badRequest("Unknown translation");
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200) {
    return badRequest("offset ≥ 0, 1 ≤ limit ≤ 200");
  }
  if (book !== undefined && (!Number.isInteger(book) || book < 1 || book > 66)) return badRequest("book must be 1..66");
  return Response.json(getOccurrences(strongs, t, offset, limit, book), { headers: STATIC_DATA_HEADERS });
}
