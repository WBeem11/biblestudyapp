import { STATIC_DATA_HEADERS, badRequest } from "@/lib/api-response";
import { searchVerses } from "@/lib/queries/search";
import { TRANSLATION_IDS } from "@/lib/reader/state";
import { toFtsQuery } from "@/lib/search/query";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const q = (p.get("q") ?? "").slice(0, 200);
  const t = (p.get("t") ?? "BSB").toUpperCase();
  const offset = Number(p.get("offset") ?? 0);
  const limit = Number(p.get("limit") ?? 50);
  const book = p.has("book") ? Number(p.get("book")) : undefined;
  const fts = toFtsQuery(q, { prefixLast: p.get("prefix") === "1" });
  if (!fts) return badRequest("Empty query");
  if (!(TRANSLATION_IDS as readonly string[]).includes(t)) return badRequest("Unknown translation");
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return badRequest("offset ≥ 0, 1 ≤ limit ≤ 100");
  }
  if (book !== undefined && (!Number.isInteger(book) || book < 1 || book > 66)) return badRequest("book must be 1..66");
  return Response.json(searchVerses(fts, t, offset, limit, book), { headers: STATIC_DATA_HEADERS });
}
