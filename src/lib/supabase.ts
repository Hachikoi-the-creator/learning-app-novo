import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase admin client.
 *
 * Uses PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. The service-role key
 * bypasses Row Level Security, which is required because `api_credentials` and
 * `study_cards` have RLS enabled with no public policies (see supabase/schema.sql).
 * The publishable/anon key is NOT allowed to write these tables.
 *
 * This module must never be imported into client-side code — the service-role
 * key is a secret and lives only in the server env.
 */

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.PUBLIC_SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL;
  const key =
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase admin is not configured. Set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env."
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** True when the Supabase admin env vars are present (used for graceful fallbacks). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    (import.meta.env.PUBLIC_SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL) &&
      (import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}
