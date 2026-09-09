import { base64Url, b64ToBuf, hmacSign, hmacVerify } from "./crypto.ts";
import { ApiError } from "./errors.ts";
import { MAX_UPLOAD_BYTES, type MediaKind } from "../../shared/domain.ts";
import type { Env } from "./types.ts";

/**
 * Media pipeline.
 *
 * R2 is the object store; D1 only keeps metadata. Uploads are *proxied* through
 * the Worker with a short-lived HMAC ticket instead of handing out S3 credentials,
 * which keeps size/type checks enforceable server-side.
 */

export const UPLOAD_TTL_SECONDS = 300;

export type UploadTicketPayload = {
  /** media row id */
  m: string;
  /** business id */
  b: string;
  /** user id */
  u: string;
  /** max bytes */
  s: number;
  /** expected content type */
  t: string;
  /** expiry (epoch seconds) */
  e: number;
};

export function r2KeyFor(businessId: string, mediaId: string): string {
  return `business/${businessId}/${mediaId}`;
}

export async function signUploadTicket(env: Env, payload: UploadTicketPayload): Promise<string> {
  const body = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSign(env.SECRET_KEY, body);
  return `${body}.${signature}`;
}

export async function verifyUploadTicket(env: Env, token: string): Promise<UploadTicketPayload> {
  const [body, signature] = token.split(".");
  if (!body || !signature) throw ApiError.forbidden("Malformed upload ticket.");
  if (!(await hmacVerify(env.SECRET_KEY, body, signature)))
    throw ApiError.forbidden("Invalid upload ticket.");
  let payload: UploadTicketPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64ToBuf(body))) as UploadTicketPayload;
  } catch {
    throw ApiError.forbidden("Malformed upload ticket.");
  }
  if (payload.e * 1000 < Date.now())
    throw ApiError.forbidden("Upload ticket expired. Request a new one.");
  return payload;
}

// ---------------------------------------------------------- content sniffing ----

type Signature = { type: (typeof MAGIC)[number]["type"]; offset: number };
const MAGIC = [
  { type: "image/jpeg" as const, bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png" as const, bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: "image/webp" as const, bytes: [0x52, 0x49, 0x46, 0x46], ascii: "WEBP", asciiAt: 8 },
  { type: "image/avif" as const, bytes: [0x66, 0x74, 0x79, 0x70], ascii: "avif", asciiAt: 4 },
];

/**
 * Confirms the bytes really are the claimed image type. Without this, a browser
 * could POST an HTML or SVG document as `image/png` and get it served back from
 * our own origin — a stored-XSS primitive.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  for (const candidate of MAGIC) {
    let ok = true;
    for (let i = 0; i < candidate.bytes.length; i++) {
      if (bytes[i] !== candidate.bytes[i]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if ("ascii" in candidate && candidate.ascii) {
      const start = candidate.asciiAt ?? 0;
      const slice = String.fromCharCode(
        ...Array.from(bytes.slice(start, start + candidate.ascii.length)),
      );
      if (slice !== candidate.ascii) continue;
    }
    return candidate.type;
  }
  return null;
}

export function assertUploadSize(sizeBytes: number): void {
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    throw new ApiError(
      "payload_too_large",
      413,
      `Images must be ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB or smaller.`,
    );
  }
}

/** Reads a bounded body; rejects before buffering anything larger than the cap. */
export async function readUploadBody(
  request: Request,
  maxBytes = MAX_UPLOAD_BYTES,
): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    throw new ApiError(
      "payload_too_large",
      413,
      `Images must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller.`,
    );
  }
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength === 0) throw ApiError.validation({ file: "The upload was empty." });
  if (buffer.byteLength > maxBytes) {
    throw new ApiError(
      "payload_too_large",
      413,
      `Images must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller.`,
    );
  }
  return new Uint8Array(buffer);
}

export function dimensionsFor(
  contentType: string,
  bytes: Uint8Array,
): { width: number; height: number } | null {
  try {
    if (contentType === "image/png" && bytes.length > 24) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    if (contentType === "image/jpeg") {
      for (let i = 0; i < bytes.length - 9; i++) {
        if (
          bytes[i] === 0xff &&
          (bytes[i + 1] ?? 0) >= 0xc0 &&
          (bytes[i + 1] ?? 0) <= 0xcf &&
          bytes[i + 1] !== 0xc4 &&
          bytes[i + 1] !== 0xc8 &&
          bytes[i + 1] !== 0xcc
        ) {
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
        }
      }
    }
    if (contentType === "image/webp" && bytes.length > 30) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38) {
        return {
          width: (1 + view.getUint8(24)) | (view.getUint8(25) << 8) | (view.getUint8(26) << 16),
          height: 1 + (view.getUint8(27) | (view.getUint8(28) << 8) | (view.getUint8(29) << 16)),
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

// -------------------------------------------------------------- responses ----

export const PRIVATE_MEDIA_KINDS: MediaKind[] = ["document"];

export function mediaHeaders(
  contentType: string,
  cacheControl = "public, max-age=31536000, immutable",
): Headers {
  return new Headers({
    "content-type": contentType,
    "cache-control": cacheControl,
    "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "cross-origin",
    "referrer-policy": "no-referrer",
  });
}

export async function putObject(
  env: Env,
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  await env.MEDIA.put(key, bytes as unknown as ArrayBuffer, {
    httpMetadata: { contentType },
    // Stored so a later GDPR delete can prove which object it removed.
    customMetadata: { uploadedAt: new Date().toISOString() },
  });
}

export async function getObject(env: Env, key: string) {
  return env.MEDIA.get(key);
}

export async function deleteObject(env: Env, key: string): Promise<void> {
  await env.MEDIA.delete(key);
}

export function checksumHex(bytes: Uint8Array): Promise<string> {
  return crypto.subtle
    .digest("SHA-256", bytes as unknown as BufferSource)
    .then((digest) =>
      Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join(""),
    );
}
