/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  /** Supabase project URL (server + build). */
  readonly SUPABASE_URL: string;
  /** Supabase service-role key — server-only, never exposed to the client. */
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  /** Base64-encoded 32-byte master key for AES-256-GCM credential encryption. */
  readonly CREDENTIALS_MASTER_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
