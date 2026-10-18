import { getSupabaseAdmin } from "./supabase";
import { encryptSecret, decryptSecret, keyHint, type EncryptedPayload } from "./crypto";

export type Provider = "gemini" | "openai";

export interface CredentialStatus {
  provider: Provider;
  key_hint: string | null;
  updated_at: string;
}

const TABLE = "api_credentials";

/**
 * Encrypt + upsert a provider API key. The plaintext key never touches the DB;
 * only the ciphertext and non-secret crypto params are stored.
 */
export async function saveCredential(provider: Provider, apiKey: string): Promise<void> {
  const payload: EncryptedPayload = encryptSecret(apiKey);
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        provider,
        ciphertext: payload.ciphertext,
        salt: payload.salt,
        iv: payload.iv,
        auth_tag: payload.authTag,
        key_hint: keyHint(apiKey),
      },
      { onConflict: "provider" }
    );

  if (error) throw new Error(`Failed to save credential: ${error.message}`);
}

/** Decrypt and return the plaintext API key for a provider, or null if unset. */
export async function getCredential(provider: Provider): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("ciphertext, salt, iv, auth_tag")
    .eq("provider", provider)
    .maybeSingle();

  if (error) throw new Error(`Failed to read credential: ${error.message}`);
  if (!data) return null;

  return decryptSecret({
    ciphertext: data.ciphertext,
    salt: data.salt,
    iv: data.iv,
    authTag: data.auth_tag,
  });
}

/** List configured providers with display hints (never returns the key itself). */
export async function listCredentialStatuses(): Promise<CredentialStatus[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("provider, key_hint, updated_at")
    .order("provider");

  if (error) throw new Error(`Failed to list credentials: ${error.message}`);
  return (data ?? []) as CredentialStatus[];
}

/** Remove a stored provider key. */
export async function deleteCredential(provider: Provider): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(TABLE).delete().eq("provider", provider);
  if (error) throw new Error(`Failed to delete credential: ${error.message}`);
}
