import { assertAllowedApiPath } from "@/config/hermeneutics";

/**
 * The only way client components may load study data. Every request is checked against
 * config/hermeneutics.ts (same-origin, allow-listed API path) before it is sent.
 */
export async function getStudyData<T>(path: string, init?: { signal?: AbortSignal }): Promise<T> {
  return (await request(path, init)).json() as Promise<T>;
}

/** Binary variant for typed-array payloads (Iconograph edges). Same guard. */
export async function getStudyBinary(path: string, init?: { signal?: AbortSignal }): Promise<ArrayBuffer> {
  return (await request(path, init)).arrayBuffer();
}

async function request(path: string, init?: { signal?: AbortSignal }) {
  assertAllowedApiPath(path);
  const res = await fetch(path, { signal: init?.signal, credentials: "same-origin" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res;
}
