import { badRequest, binary } from "@/lib/api-response";
import { encodeVerseEdges } from "@/lib/iconograph/format";
import { getVerseEdges } from "@/lib/queries/iconograph";
import { TOTAL_CHAPTERS } from "@/lib/refs";

/** Max chapters per window; the client only asks for verse detail when zoomed in. */
const MAX_SPAN = 160;

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const lo = Number(p.get("lo"));
  const hi = Number(p.get("hi"));
  const min = Number(p.get("min") ?? 0);
  if (![lo, hi, min].every(Number.isInteger) || lo < 1 || hi > TOTAL_CHAPTERS || lo > hi || hi - lo >= MAX_SPAN) {
    return badRequest(`Expected integer lo..hi chapter ordinals within 1..${TOTAL_CHAPTERS}, span < ${MAX_SPAN}`);
  }
  return binary(request, encodeVerseEdges(getVerseEdges(lo, hi, min)));
}
