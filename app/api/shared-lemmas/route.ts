import { STATIC_DATA_HEADERS, badRequest } from "@/lib/api-response";
import { getSharedLemmas } from "@/lib/queries/concordance";

/** `?a=43003016&b=62004009-62004010`: verse-id ranges (each at most 8 verses). */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const parse = (s: string | null): [number, number] | null => {
    const [x, y = x] = (s ?? "").split("-").map(Number);
    return Number.isInteger(x) && Number.isInteger(y) && x > 0 && y >= x && y - x < 8 ? [x, y] : null;
  };
  const a = parse(p.get("a"));
  const b = parse(p.get("b"));
  if (!a || !b) return badRequest("Expected a=verseId[-verseId]&b=verseId[-verseId], ranges of at most 8 verses");
  return Response.json({ shared: getSharedLemmas(a, b) }, { headers: STATIC_DATA_HEADERS });
}
