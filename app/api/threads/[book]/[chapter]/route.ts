import { STATIC_DATA_HEADERS, badRequest } from "@/lib/api-response";
import { getChapterThreads } from "@/lib/queries/threads";
import { bookById } from "@/lib/refs";

export async function GET(_: Request, { params }: RouteContext<"/api/threads/[book]/[chapter]">) {
  const { book, chapter } = await params;
  const b = bookById(Number(book));
  const c = Number(chapter);
  if (!b || !Number.isInteger(c) || c < 1 || c > b.chapters) return badRequest("Unknown chapter", 404);
  return Response.json(getChapterThreads(b.id, c), { headers: STATIC_DATA_HEADERS });
}
