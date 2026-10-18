import type { Provider } from "./credentials";
import type { AIAnalysisResult } from "./srs";

/**
 * Thin provider layer for Gemini + OpenAI. Uses each provider's REST API
 * directly (no SDK) so there are no extra dependencies. All calls happen
 * server-side with a decrypted key.
 */

export interface ProviderTestResult {
  ok: boolean;
  message: string;
}

const SYSTEM_PROMPT = `You are an expert Cybersecurity Technical Tutor.
Analyze the user's raw study notes and:
1. Break the content into distinct, modular topics/cards.
2. Fact-check technical claims (command flags, RFC standards, protocol ports, vulnerabilities).
3. Respond ONLY with JSON matching this shape:
{
  "summary_of_session": string,
  "proposed_cards": [{
    "temp_id": string,
    "suggested_title": string,
    "topic_category": string,
    "suggested_content_html": string,
    "fact_checks": [{
      "original_claim": string,
      "verdict": "VERIFIED" | "QUESTIONABLE" | "INCORRECT",
      "correction": string,
      "reason": string
    }]
  }]
}`;

/** Lightweight connectivity/auth check for a provider key. */
export async function testProviderKey(
  provider: Provider,
  apiKey: string
): Promise<ProviderTestResult> {
  try {
    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
      );
      if (res.ok) return { ok: true, message: "Gemini key is valid." };
      if (res.status === 400 || res.status === 403)
        return { ok: false, message: "Gemini rejected the key (invalid or unauthorized)." };
      return { ok: false, message: `Gemini returned HTTP ${res.status}.` };
    }

    // openai
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) return { ok: true, message: "OpenAI key is valid." };
    if (res.status === 401)
      return { ok: false, message: "OpenAI rejected the key (unauthorized)." };
    return { ok: false, message: `OpenAI returned HTTP ${res.status}.` };
  } catch (e) {
    return { ok: false, message: `Network error: ${(e as Error).message}` };
  }
}

/** Run the study-notes analysis against the chosen provider. */
export async function analyzeWithProvider(
  provider: Provider,
  apiKey: string,
  rawNotes: string
): Promise<AIAnalysisResult> {
  const raw =
    provider === "gemini"
      ? await callGemini(apiKey, rawNotes)
      : await callOpenAI(apiKey, rawNotes);
  return coerceResult(raw);
}

async function callGemini(apiKey: string, notes: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: notes }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

async function callOpenAI(apiKey: string, notes: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: notes },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? "{}";
}

/** Parse + lightly normalize the model's JSON into AIAnalysisResult. */
function coerceResult(raw: string): AIAnalysisResult {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Try to salvage a JSON object embedded in prose.
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : { proposed_cards: [] };
  }

  const cards = Array.isArray(parsed.proposed_cards) ? parsed.proposed_cards : [];
  return {
    summary_of_session: String(parsed.summary_of_session ?? "Analysis complete."),
    proposed_cards: cards.map((c: any, i: number) => ({
      temp_id: String(c.temp_id ?? `p${i + 1}`),
      suggested_title: String(c.suggested_title ?? "Untitled"),
      topic_category: String(c.topic_category ?? "General"),
      suggested_content_html: String(c.suggested_content_html ?? ""),
      fact_checks: Array.isArray(c.fact_checks)
        ? c.fact_checks.map((f: any) => ({
            original_claim: String(f.original_claim ?? ""),
            verdict: ["VERIFIED", "QUESTIONABLE", "INCORRECT"].includes(f.verdict)
              ? f.verdict
              : "QUESTIONABLE",
            correction: String(f.correction ?? ""),
            reason: String(f.reason ?? ""),
          }))
        : [],
    })),
  };
}
