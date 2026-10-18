import type { APIRoute } from "astro";
import {
  saveCredential,
  deleteCredential,
  listCredentialStatuses,
  type Provider,
} from "../../lib/credentials";
import { isSupabaseConfigured } from "../../lib/supabase";

export const prerender = false;

const PROVIDERS: Provider[] = ["gemini", "openai"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requireConfig(): Response | null {
  if (!isSupabaseConfigured()) {
    return json(
      { error: "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      503
    );
  }
  return null;
}

/** GET → which providers are configured (hints only, never the key). */
export const GET: APIRoute = async () => {
  const notReady = requireConfig();
  if (notReady) return notReady;
  try {
    const statuses = await listCredentialStatuses();
    return json({ credentials: statuses });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};

/** POST { provider, apiKey } → encrypt + store. */
export const POST: APIRoute = async ({ request }) => {
  const notReady = requireConfig();
  if (notReady) return notReady;
  try {
    const { provider, apiKey } = await request.json();
    if (!PROVIDERS.includes(provider)) return json({ error: "Invalid provider." }, 400);
    if (typeof apiKey !== "string" || apiKey.trim().length < 8)
      return json({ error: "API key looks too short." }, 400);

    await saveCredential(provider, apiKey.trim());
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};

/** DELETE { provider } → remove the stored key. */
export const DELETE: APIRoute = async ({ request }) => {
  const notReady = requireConfig();
  if (notReady) return notReady;
  try {
    const { provider } = await request.json();
    if (!PROVIDERS.includes(provider)) return json({ error: "Invalid provider." }, 400);
    await deleteCredential(provider);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
