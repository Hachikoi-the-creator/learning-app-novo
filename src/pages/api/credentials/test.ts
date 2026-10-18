import type { APIRoute } from "astro";
import { getCredential, type Provider } from "../../../lib/credentials";
import { testProviderKey } from "../../../lib/providers";
import { isSupabaseConfigured } from "../../../lib/supabase";

export const prerender = false;

const PROVIDERS: Provider[] = ["gemini", "openai"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST { provider, apiKey? }
 *  - If `apiKey` is provided, test that raw key (pre-save check).
 *  - Otherwise test the stored key for the provider.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const { provider, apiKey } = await request.json();
    if (!PROVIDERS.includes(provider)) return json({ error: "Invalid provider." }, 400);

    let key: string | null = typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : null;

    if (!key) {
      if (!isSupabaseConfigured())
        return json({ error: "Supabase is not configured." }, 503);
      key = await getCredential(provider);
      if (!key) return json({ ok: false, message: "No key stored for this provider." }, 404);
    }

    const result = await testProviderKey(provider, key);
    return json(result, result.ok ? 200 : 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
