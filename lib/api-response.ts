import "server-only";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

// Study data only changes when the database is rebuilt, which ships with a deploy.
export const STATIC_DATA_HEADERS = { "Cache-Control": "public, max-age=3600, s-maxage=86400" };

const compressedCache = new Map<string, Buffer>();

/**
 * Binary response, compressed here because Next/most CDNs skip application/octet-stream.
 * Pass `cacheKey` for payloads that are identical across requests (memoizes the compression).
 */
export function binary(request: Request, buf: ArrayBuffer, cacheKey?: string) {
  const accept = request.headers.get("accept-encoding") ?? "";
  const encoding = /\bbr\b/.test(accept) ? "br" : /\bgzip\b/.test(accept) ? "gzip" : null;
  const headers: Record<string, string> = {
    ...STATIC_DATA_HEADERS,
    "Content-Type": "application/octet-stream",
    Vary: "Accept-Encoding",
  };
  if (!encoding) return new Response(buf, { headers });

  const key = cacheKey && `${cacheKey}:${encoding}`;
  let body = key ? compressedCache.get(key) : undefined;
  if (!body) {
    const raw = Buffer.from(buf);
    body =
      encoding === "br"
        ? // q9 ≈ 55 ms for the 1.4 MB overview; q11 saves ~15% more but takes ~1.4 s on a cold start.
          brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: cacheKey ? 9 : 5, [constants.BROTLI_PARAM_SIZE_HINT]: raw.length } })
        : gzipSync(raw, { level: 6 });
    if (key) compressedCache.set(key, body);
  }
  return new Response(new Uint8Array(body), { headers: { ...headers, "Content-Encoding": encoding } });
}

export function badRequest(error: string, status = 400) {
  return Response.json({ error }, { status });
}
