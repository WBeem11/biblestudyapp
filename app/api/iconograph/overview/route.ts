import { binary } from "@/lib/api-response";
import { encodeOverview } from "@/lib/iconograph/format";
import { getOverview } from "@/lib/queries/iconograph";

export async function GET(request: Request) {
  return binary(request, encodeOverview(getOverview()), "overview");
}
