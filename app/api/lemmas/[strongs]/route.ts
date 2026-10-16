import { STATIC_DATA_HEADERS, badRequest } from "@/lib/api-response";
import { getLemma } from "@/lib/queries/concordance";

const LEMMA_KEY = /^[HG]\d{4}[A-Za-z]?$/;

export async function GET(_: Request, { params }: RouteContext<"/api/lemmas/[strongs]">) {
  const { strongs } = await params;
  if (!LEMMA_KEY.test(strongs)) return badRequest("Expected a Strong's key like H7225G or G0026");
  const lemma = getLemma(strongs);
  return lemma ? Response.json(lemma, { headers: STATIC_DATA_HEADERS }) : badRequest("Unknown lemma", 404);
}
