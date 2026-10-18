import type { APIRoute } from "astro";
import {
  getCredential,
  listCredentialStatuses,
  type Provider,
} from "../../lib/credentials";
import { analyzeWithProvider } from "../../lib/providers";
import { isSupabaseConfigured } from "../../lib/supabase";
import { SAMPLE_ANALYSIS } from "../../lib/srs";

export const prerender = false;

const PROVIDERS: Provider[] = ["gemini", "openai"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST { notes, provider? }
 * Analyzes the raw notes with the chosen (or first configured) provider.
 * If no provider is configured, returns the sample analysis so the UI
 * still works as a demo (flagged via `demo: true`).
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const { notes, provider: requested } = await request.json();
    if (typeof notes !== "string" || !notes.trim())
      return json({ error: "No notes provided." }, 400);

    // Fallback to the canned sample if the backend isn't wired up yet.
    if (!isSupabaseConfigured()) {
      return json({ ...SAMPLE_ANALYSIS, demo: true });
    }

    // Choose provider: explicit request, else the first configured one.
    let provider: Provider | null =
      PROVIDERS.includes(requested) ? requested : null;
    if (!provider) {
      const statuses = await listCredentialStatuses();
      provider = (statuses[0]?.provider as Provider) ?? null;
    }
    if (!provider) {
      return json({ ...SAMPLE_ANALYSIS, demo: true });
    }

    const key = await getCredential(provider);
    if (!key) return json({ ...SAMPLE_ANALYSIS, demo: true });

    const result = await analyzeWithProvider(provider, key, notes);
    return json({ ...result, provider });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
