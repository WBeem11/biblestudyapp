import { STATIC_DATA_HEADERS, badRequest } from "@/lib/api-response";
import { getChapterPairRefs } from "@/lib/queries/iconograph";
import { getPassageText } from "@/lib/queries/passages";
import { TRANSLATION_IDS } from "@/lib/reader/state";
import { TOTAL_CHAPTERS } from "@/lib/refs";

export async function GET(request: Request, { params }: RouteContext<"/api/iconograph/pair/[a]/[b]">) {
  const { a, b } = await params;
  const [x, y] = [Number(a), Number(b)];
  const t = (new URL(request.url).searchParams.get("t") ?? "BSB").toUpperCase();
  if (![x, y].every((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL_CHAPTERS)) return badRequest("Unknown chapter", 404);
  if (!(TRANSLATION_IDS as readonly string[]).includes(t)) return badRequest("Unknown translation");

  const pairs = getChapterPairRefs(x, y, 3).map((r) => ({
    ...r,
    fromText: getPassageText(r.from, r.from, t).text,
    to: getPassageText(r.toStart, r.toEnd, t, 2),
  }));
  return Response.json({ pairs }, { headers: STATIC_DATA_HEADERS });
}
