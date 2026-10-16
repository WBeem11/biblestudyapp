/** Welcome-gateway sign-up logic. Client-safe and network-free: the Supabase client is passed in. */
import type { SupabaseClient } from "@supabase/supabase-js";

export const ENTERED_KEY = "biblestudy_entered";

/** Postgres unique_violation: the email is already subscribed (a returning student). */
const UNIQUE_VIOLATION = "23505";

export type SubscribeResult =
  | "subscribed" // new subscriber
  | "returning" // already subscribed: let them in silently
  | "invalid" // fails basic email format validation
  | "unavailable" // Supabase isn't configured in this build
  | "error"; // anything else (network, policy): stay on the gateway

/**
 * Trim and lowercase, then a basic format check (something@something.tld, no spaces, ≤ 254 chars).
 * Lowercasing keeps the unique constraint meaningful: Postgres compares text case-sensitively.
 */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export async function subscribe(raw: string, client: SupabaseClient | null): Promise<SubscribeResult> {
  const email = normalizeEmail(raw);
  if (!email) return "invalid";
  if (!client) return "unavailable";
  try {
    // No .select(): an insert-only policy is enough, and nothing is read back.
    const { error } = await client.from("subscribers").insert([{ email }]);
    if (!error) return "subscribed";
    return error.code === UNIQUE_VIOLATION ? "returning" : "error";
  } catch {
    return "error";
  }
}

/** localStorage can throw (private mode, blocked storage): never let that break the app. */
export function hasEntered(): boolean {
  try {
    return localStorage.getItem(ENTERED_KEY) === "true";
  } catch {
    return false;
  }
}

export function markEntered(): void {
  try {
    localStorage.setItem(ENTERED_KEY, "true");
  } catch {
    // Storage unavailable: they still get in for this visit.
  }
}
