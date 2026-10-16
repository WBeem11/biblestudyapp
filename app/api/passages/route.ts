import { STATIC_DATA_HEADERS, badRequest } from "@/lib/api-response";
import { getPassageText } from "@/lib/queries/passages";
import { TRANSLATION_IDS } from "@/lib/reader/state";

/** `?r=43003016,45005008-45005010&t=BSB`: up to 4 verse ranges (verse ids), each capped at 4 verses. */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const t = (p.get("t") ?? "BSB").toUpperCase();
  if (!(TRANSLATION_IDS as readonly string[]).includes(t)) return badRequest("Unknown translation");

  const ranges = (p.get("r") ?? "").split(",").filter(Boolean).map((s) => s.split("-").map(Number));
  if (!ranges.length || ranges.length > 4 || ranges.some((r) => r.length > 2 || !r.every(Number.isInteger))) {
    return badRequest("Expected r=start[-end],… with up to 4 verse-id ranges");
  }
  return Response.json(
    { passages: ranges.map(([s, e = s]) => getPassageText(s, e, t)) },
    { headers: STATIC_DATA_HEADERS },
  );
}
