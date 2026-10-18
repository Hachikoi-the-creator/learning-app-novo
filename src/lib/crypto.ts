import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";

/**
 * Credential encryption — AES-256-GCM with per-record key derivation.
 *
 * Security model:
 *  - The master key lives ONLY in the server env (CREDENTIALS_MASTER_KEY),
 *    never in the database.
 *  - Each stored secret gets a fresh random `salt` and `iv`.
 *  - A per-record 256-bit key is derived with scrypt(masterKey, salt).
 *    So even if two records held the same plaintext, their ciphertext differs,
 *    and leaking one record's salt/iv tells an attacker nothing useful.
 *  - GCM produces an `authTag` that detects tampering on decrypt.
 *
 * `salt`, `iv`, and `authTag` are NOT secret — storing them beside the
 * ciphertext in the DB is safe and standard.
 */

const ALGO = "aes-256-gcm";
const KEY_LEN = 32; // 256-bit
const SALT_LEN = 16;
const IV_LEN = 12; // 96-bit nonce, recommended for GCM

export interface EncryptedPayload {
  ciphertext: string; // base64
  salt: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

let cachedMasterKey: Buffer | null = null;

/** Load + validate the master key from env (cached). */
function getMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;

  const raw = import.meta.env.CREDENTIALS_MASTER_KEY ?? process.env.CREDENTIALS_MASTER_KEY;
  if (!raw) {
    throw new Error(
      "CREDENTIALS_MASTER_KEY is not set. Generate one with:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }

  // Accept base64 or hex; must decode to exactly 32 bytes.
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
    if (key.length !== KEY_LEN) key = Buffer.from(raw, "hex");
  } catch {
    key = Buffer.from(raw, "hex");
  }

  if (key.length !== KEY_LEN) {
    throw new Error(
      `CREDENTIALS_MASTER_KEY must decode to ${KEY_LEN} bytes (got ${key.length}). ` +
        "Generate a valid key with the command in .env.example."
    );
  }

  cachedMasterKey = key;
  return key;
}

/** Derive a per-record 256-bit key from the master key + record salt. */
function deriveKey(masterKey: Buffer, salt: Buffer): Buffer {
  // scrypt is deliberately slow/memory-hard; fine for per-request credential ops.
  return scryptSync(masterKey, salt, KEY_LEN, { N: 16384, r: 8, p: 1 });
}

/** Encrypt a plaintext secret. Returns base64 ciphertext + salt + iv + authTag. */
export function encryptSecret(plaintext: string): EncryptedPayload {
  const masterKey = getMasterKey();
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(masterKey, salt);

  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/** Decrypt a payload produced by {@link encryptSecret}. Throws if tampered. */
export function decryptSecret(payload: EncryptedPayload): string {
  const masterKey = getMasterKey();
  const salt = Buffer.from(payload.salt, "base64");
  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");
  const key = deriveKey(masterKey, salt);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(), // throws if the auth tag doesn't verify
  ]);
  return plaintext.toString("utf8");
}

/** Last-4 display hint, e.g. "…aB3d". Never store/show more than this. */
export function keyHint(secret: string): string {
  const tail = secret.slice(-4);
  return tail ? `…${tail}` : "…";
}

/** Constant-time string compare (for any future token checks). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
