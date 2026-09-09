/** Crypto helpers — WebCrypto only (no node:crypto) so the code runs identically in workerd and tests. */

const encoder = new TextEncoder();

export function randomId(prefix = ""): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return prefix ? `${prefix}_${hex}` : hex;
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64Url(buf);
}

export function base64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function b64ToBuf(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const data = typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Session/claim tokens are hashed before storage so a DB read cannot mint a session. */
export async function hashToken(token: string): Promise<string> {
  return sha256Hex(token);
}

/**
 * 210k PBKDF2-SHA256 iterations costs roughly 50–150ms of CPU in workerd, which is why
 * `wrangler.jsonc` raises `limits.cpu_ms` above the 50ms default — with the default in
 * place every sign-in dies on a CPU-limit exception that never appears locally. Lower it
 * only together with a migration story; the cost is recorded inside each hash (see
 * `needsRehash`), so existing users keep verifying at their own iteration count.
 */
const PBKDF2_ITERATIONS = 210_000;

/** True when a stored hash should be rewritten with the current cost parameter. */
export function needsRehash(stored: string): boolean {
  const [scheme, iterationsRaw] = stored.split("$");
  if (scheme !== "pbkdf2-sha256") return true;
  return Number.parseInt(iterationsRaw ?? "", 10) !== PBKDF2_ITERATIONS;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${bufToB64(salt.buffer)}$${bufToB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterationsRaw, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2-sha256" || !saltB64 || !hashB64) return false;
  const iterations = Number.parseInt(iterationsRaw ?? "", 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = b64ToBuf(saltB64);
  const expected = b64ToBuf(hashB64);
  const actual = b64ToBuf(bufToB64(await pbkdf2(password, salt, iterations)));
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    256,
  );
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64Url(sig);
}

export async function hmacVerify(
  secret: string,
  payload: string,
  signature: string,
): Promise<boolean> {
  if (!signature) return false;
  const expected = await hmacSign(secret, payload);
  return timingSafeEqual(encoder.encode(expected), encoder.encode(signature));
}

/** Short, unambiguous code for public URLs (no vowels, no 0/O/1/I). */
const CODE_ALPHABET = "bcdfghjklmnpqrstvwxyz23456789";

export function shortCode(length = 7): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}
