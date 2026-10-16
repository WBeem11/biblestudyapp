import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for the welcome gateway's email sign-up (insert into `subscribers` only).
 * Never used for study content: see config/hermeneutics.ts → externalServices.
 *
 * Created lazily on first use, not at import: NEXT_PUBLIC_* values are inlined at build time, and
 * creating the client at module scope throws during static generation whenever they're unset
 * (local builds, CI). Returns null when the project isn't configured.
 */
let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  // Referenced literally so Next.js can inline them into the client bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Supabase's publishable key (sb_publishable_…); the legacy anon key works the same way.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && anonKey
    ? createClient(url, anonKey, {
        // Insert-only use: no sign-in, so don't persist or refresh auth sessions in the browser.
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : null;
  return client;
}
