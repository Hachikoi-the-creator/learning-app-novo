/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  /** Supabase project URL (server + build). */
  readonly PUBLIC_SUPABASE_URL: string;
  /** Supabase publishable (public) key — per the official Astro quickstart. */
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  /** Supabase service-role (secret) key — server-only, bypasses RLS. */
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  /** Base64-encoded 32-byte master key for AES-256-GCM credential encryption. */
  readonly CREDENTIALS_MASTER_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
