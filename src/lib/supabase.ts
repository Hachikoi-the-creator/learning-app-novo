import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the SERVICE-ROLE key.
 *
 * This key bypasses Row Level Security and must NEVER reach the browser.
 * It is only imported from API routes (`src/pages/api/**`) that run on the
 * server (prerender = false). Do not import this file from a `.astro`
 * component that renders to the client.
 */

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRole =
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env."
    );
  }

  client = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** True when the Supabase env vars are present (used for graceful fallbacks). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    (import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL) &&
      (import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}
