import { catalogItemInput, mediaConfirmInput, uploadIntentInput } from "../../../shared/api.ts";
import { MAX_UPLOAD_BYTES, type MediaKind } from "../../../shared/domain.ts";
import { DB } from "../db-access.ts";
import { newId, nowIso } from "../db.ts";
import { ApiError } from "../errors.ts";
import { json, parseBody } from "../http.ts";
import { requireAccess } from "../auth.ts";
import { recordAudit } from "../audit.ts";
import { notifyBusinessOwners } from "../notifications.ts";
import { enforceLimit, limitIdentity } from "../ratelimit.ts";
import { assertWithinPlan, access } from "./guards.ts";
import { recomputeCompleteness } from "./workspace.ts";
import {
  assertUploadSize,
  checksumHex,
  deleteObject,
  dimensionsFor,
  mediaHeaders,
  putObject,
  r2KeyFor,
  readUploadBody,
  signUploadTicket,
  sniffImageType,
  UPLOAD_TTL_SECONDS,
  verifyUploadTicket,
} from "../media.ts";
import type { AppContext } from "../types.ts";

// ------------------------------------------------------- services / products ----

type CatalogTable = "services" | "products";

/**
 * `services` and `products` share a shape except for one free-text column: a service
 * carries a `note`, a product carries a `tag`. The migration says so, so the code
 * names that single difference instead of assuming both tables have both columns.
 */
const TABLES: Record<CatalogTable, { sqlTable: string; detail: "note" | "tag"; prefix: string }> = {
  services: { sqlTable: "services", detail: "note", prefix: "srv" },
  products: { sqlTable: "products", detail: "tag", prefix: "prd" },
};

export async function listCatalog(c: AppContext, table: CatalogTable): Promise<Response> {
  const actor = await access(c, "profile:read");
  const config = TABLES[table];
  const rows = await DB.all<CatalogRow>(
    c.env,
    `SELECT id, name, price_minor, ${config.detail} AS detail, active, position, created_at, updated_at
       FROM ${config.sqlTable} WHERE business_id = ? ORDER BY position, name`,
    [actor.businessId],
  );
  return json({
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      priceMinor: row.price_minor,
      note: config.detail === "note" ? (row.detail ?? null) : null,
      tag: config.detail === "tag" ? (row.detail ?? null) : null,
      active: row.active === 1,
      position: row.position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
}

type CatalogRow = {
  id: string;
  name: string;
  price_minor: number | null;
  detail: string | null;
  active: number;
  position: number;
  created_at: string;
  updated_at: string;
};

export async function createCatalogItem(c: AppContext, table: CatalogTable): Promise<Response> {
  const actor = await access(c, "catalog:write");
  const input = await parseBody(catalogItemInput, c.request);
  const config = TABLES[table];
  const existing = await DB.count(
    c.env,
    `SELECT COUNT(*) AS n FROM ${config.sqlTable} WHERE business_id = ?`,
    [actor.businessId],
  );
  if (existing >= 100) throw ApiError.domain("100 catalogue items is the maximum per listing.");
  const duplicate = await DB.first<{ id: string }>(
    c.env,
    `SELECT id FROM ${config.sqlTable} WHERE business_id = ? AND lower(name) = lower(?)`,
    [actor.businessId, input.name],
  );
  if (duplicate)
    throw ApiError.conflict("You already list an item with that name.", {
      name: "Duplicate item.",
    });

  const id = newId(config.prefix);
  const now = nowIso();
  const detailValue = config.detail === "note" ? input.note || null : input.tag || null;
  const columns = [
    "id",
    "business_id",
    "name",
    "price_minor",
    config.detail,
    "active",
    "position",
    "created_at",
    "updated_at",
  ];
  const values: unknown[] = [
    id,
    actor.businessId,
    input.name,
    input.priceMinor ?? null,
    detailValue,
    input.active ? 1 : 0,
    existing,
    now,
    now,
  ];
  await DB.run(
    c.env,
    `INSERT INTO ${config.sqlTable} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    values,
  );
  await recomputeCompleteness(c, actor.businessId);
  return json({ ok: true, id }, { status: 201 });
}

export async function updateCatalogItem(c: AppContext, table: CatalogTable): Promise<Response> {
  const actor = await access(c, "catalog:write");
  const config = TABLES[table];
  const input = await parseBody(catalogItemInput, c.request);
  const id = c.params["itemId"] ?? "";
  const detailValue = config.detail === "note" ? input.note || null : input.tag || null;
  const result = await DB.run(
    c.env,
    `UPDATE ${config.sqlTable} SET name = ?, price_minor = ?, ${config.detail} = ?, active = ?, updated_at = ?
      WHERE id = ? AND business_id = ?`,
    [
      input.name,
      input.priceMinor ?? null,
      detailValue,
      input.active ? 1 : 0,
      nowIso(),
      id,
      actor.businessId,
    ],
  );
  if (!(result as unknown as { meta?: { changes?: number } }).meta?.changes)
    throw ApiError.notFound("Item not found in this listing.");
  return json({ ok: true });
}

export async function deleteCatalogItem(c: AppContext, table: CatalogTable): Promise<Response> {
  const actor = await access(c, "catalog:write");
  const config = TABLES[table];
  // Soft-hide instead of DELETE: enquiries reference services by id, and a hard
  // delete would orphan them (RESTRICT) and break customer history.
  const result = await DB.run(
    c.env,
    `UPDATE ${config.sqlTable} SET active = 0, updated_at = ? WHERE id = ? AND business_id = ?`,
    [nowIso(), c.params["itemId"] ?? "", actor.businessId],
  );
  if (!(result as unknown as { meta?: { changes?: number } }).meta?.changes)
    throw ApiError.notFound("Item not found in this listing.");
  return json({ ok: true, hidden: true });
}

// -------------------------------------------------------------------- media ----

export async function listMedia(c: AppContext): Promise<Response> {
  const actor = await access(c, "profile:read");
  const rows = await DB.all<MediaListRow>(
    c.env,
    `SELECT id, kind, label, alt, content_type, size_bytes, width, height, position, moderation_status, moderation_note, is_primary, created_at
       FROM media WHERE business_id = ? AND deleted_at IS NULL ORDER BY position, created_at DESC`,
    [actor.businessId],
  );
  const apiBase = c.env.API_URL ?? c.url.origin;
  return json({
    items: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      label: row.label,
      alt: row.alt,
      contentType: row.content_type,
      sizeBytes: Number(row.size_bytes ?? 0),
      width: row.width,
      height: row.height,
      position: row.position,
      moderation: row.moderation_status,
      moderationNote: row.moderation_note,
      primary: row.is_primary === 1,
      createdAt: row.created_at,
      url: `${apiBase}/media/${row.id}`,
    })),
  });
}

type MediaListRow = {
  id: string;
  kind: MediaKind;
  label: string | null;
  alt: string;
  content_type: string;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  position: number;
  moderation_status: string;
  moderation_note: string | null;
  is_primary: number;
  created_at: string;
};

export async function createUploadIntent(c: AppContext): Promise<Response> {
  const actor = await access(c, "media:write");
  const input = await parseBody(uploadIntentInput, c.request);
  await enforceLimit(c.env, "media_upload", limitIdentity(c.session?.user.id ?? null, c.ipHash));

  const current = await DB.count(
    c.env,
    "SELECT COUNT(*) AS n FROM media WHERE business_id = ? AND deleted_at IS NULL",
    [actor.businessId],
  );
  await assertWithinPlan(c, actor.businessId, "media", current + 1);
  assertUploadSize(input.sizeBytes);

  const id = newId("med");
  const now = nowIso();
  const position = await DB.count(
    c.env,
    "SELECT COALESCE(MAX(position), -1) + 1 AS n FROM media WHERE business_id = ? AND kind = ? AND deleted_at IS NULL",
    [actor.businessId, input.kind],
  );
  await DB.run(
    c.env,
    `INSERT INTO media (id, business_id, uploaded_by_user_id, kind, label, alt, r2_key, content_type, size_bytes, position, moderation_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      id,
      actor.businessId,
      c.session?.user.id ?? null,
      input.kind,
      input.label ?? null,
      input.alt ?? `${input.fileName.replace(/\.[a-z0-9]+$/i, "")}`,
      r2KeyFor(actor.businessId, id),
      input.contentType,
      input.sizeBytes,
      Math.max(0, position - 1),
      now,
    ],
  );

  const token = await signUploadTicket(c.env, {
    m: id,
    b: actor.businessId,
    u: c.session?.user.id ?? "anon",
    s: Math.min(input.sizeBytes, MAX_UPLOAD_BYTES),
    t: input.contentType,
    e: Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS,
  });
  const apiBase = c.env.API_URL ?? c.url.origin;
  return json(
    {
      mediaId: id,
      method: "PUT",
      url: `${apiBase}/media/upload/${token}`,
      headers: { "content-type": input.contentType },
      expiresAt: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000).toISOString(),
      maxSizeBytes: Math.min(input.sizeBytes, MAX_UPLOAD_BYTES),
    },
    { status: 201 },
  );
}

/**
 * The upload endpoint is the only place bytes enter R2. It re-checks size, sniffs
 * magic bytes and rejects a mismatch — a file cannot claim `image/png` while
 * carrying HTML.
 */
export async function uploadMedia(c: AppContext): Promise<Response> {
  const payload = await verifyUploadTicket(c.env, c.params["token"] ?? "");
  const media = await DB.first<{
    id: string;
    business_id: string;
    kind: string;
    content_type: string;
    deleted_at: string | null;
  }>(c.env, "SELECT id, business_id, kind, content_type, deleted_at FROM media WHERE id = ?", [
    payload.m,
  ]);
  if (!media || media.deleted_at) throw ApiError.notFound("Upload target no longer exists.");
  if (media.business_id !== payload.b)
    throw ApiError.forbidden("Upload ticket does not match this listing.");

  const bytes = await readUploadBody(c.request, Math.min(payload.s, MAX_UPLOAD_BYTES));
  const sniffed = sniffImageType(bytes);
  if (!sniffed) {
    await DB.run(
      c.env,
      "UPDATE media SET moderation_status = 'rejected', moderation_note = ? WHERE id = ?",
      ["File content is not a supported image type.", media.id],
    );
    throw new ApiError(
      "unsupported_media_type",
      415,
      "Only JPEG, PNG, WebP or AVIF images are accepted.",
    );
  }
  if (sniffed !== payload.t) {
    throw ApiError.validation({ file: `That file is ${sniffed}, not ${payload.t}.` });
  }

  await putObject(c.env, r2KeyFor(media.business_id, media.id), bytes, sniffed);
  const dims = dimensionsFor(sniffed, bytes);
  const checksum = await checksumHex(bytes);
  await DB.run(
    c.env,
    "UPDATE media SET content_type = ?, size_bytes = ?, width = ?, height = ?, checksum = ?, created_at = created_at WHERE id = ?",
    [sniffed, bytes.byteLength, dims?.width ?? null, dims?.height ?? null, checksum, media.id],
  );

  // Images go to the moderation queue before they are public; documents stay private.
  const isPrivate = media.kind === "document";
  if (!isPrivate) {
    await DB.run(
      c.env,
      `INSERT INTO moderation_items (id, item_type, target_id, business_id, reason, detail_json, risk, status, source, created_at)
       VALUES (?, 'media', ?, ?, 'New image awaiting review', ?, 'low', 'pending', 'automated', ?)
       ON CONFLICT (item_type, target_id) DO NOTHING`,
      [
        newId("mod"),
        media.id,
        media.business_id,
        JSON.stringify({ kind: payload.t, bytes: bytes.byteLength }),
        nowIso(),
      ],
    );
  } else {
    await DB.run(c.env, "UPDATE media SET moderation_status = 'approved' WHERE id = ?", [media.id]);
  }
  await recomputeCompleteness(c, media.business_id);

  return json(
    {
      ok: true,
      mediaId: media.id,
      bytes: bytes.byteLength,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
    },
    { status: 201 },
  );
}

export async function confirmUpload(c: AppContext): Promise<Response> {
  const actor = await access(c, "media:write");
  const input = await parseBody(mediaConfirmInput, c.request);
  const media = await DB.first<{ id: string; business_id: string; size_bytes: number | null }>(
    c.env,
    "SELECT id, business_id, size_bytes FROM media WHERE id = ? AND deleted_at IS NULL",
    [input.mediaId],
  );
  if (!media || media.business_id !== actor.businessId) throw ApiError.notFound("Media not found.");
  if (!media.size_bytes) throw ApiError.domain("The upload has not finished yet.");
  return json({ ok: true, uploaded: true, bytes: Number(media.size_bytes) });
}

export async function setPrimaryMedia(c: AppContext): Promise<Response> {
  const actor = await access(c, "media:write");
  const id = c.params["mediaId"] ?? "";
  const media = await DB.first<{ id: string; kind: string }>(
    c.env,
    "SELECT id, kind FROM media WHERE id = ? AND business_id = ? AND deleted_at IS NULL",
    [id, actor.businessId],
  );
  if (!media) throw ApiError.notFound("Media not found.");
  await DB.write(c.env, [
    {
      sql: "UPDATE media SET is_primary = 0 WHERE business_id = ? AND kind = ?",
      params: [actor.businessId, media.kind],
    },
    { sql: "UPDATE media SET is_primary = 1 WHERE id = ?", params: [id] },
  ]);
  return json({ ok: true });
}

export async function deleteMedia(c: AppContext): Promise<Response> {
  const actor = await access(c, "media:write");
  const id = c.params["mediaId"] ?? "";
  const media = await DB.first<{ id: string; r2_key: string; kind: string }>(
    c.env,
    "SELECT id, r2_key, kind FROM media WHERE id = ? AND business_id = ? AND deleted_at IS NULL",
    [id, actor.businessId],
  );
  if (!media) throw ApiError.notFound("Media not found.");
  const now = nowIso();
  await DB.write(c.env, [
    {
      sql: "UPDATE media SET deleted_at = ?, moderation_status = 'removed' WHERE id = ?",
      params: [now, id],
    },
    {
      sql: "UPDATE moderation_items SET status = 'rejected', decision_note = 'Deleted by owner', decided_at = ? WHERE item_type = 'media' AND target_id = ? AND status = 'pending'",
      params: [now, id],
    },
  ]);
  // Object removal is async: a slow bucket never blocks the UI. The bytes stay
  // until the purge job runs, so an accidental delete can still be undone.
  c.execution.waitUntil(
    c.env.EMAIL_QUEUE.send({ type: "media_delete", key: media.r2_key, mediaId: id }).catch(
      () => undefined,
    ),
  );
  await recomputeCompleteness(c, actor.businessId);
  await recordAudit(c.env, {
    businessId: actor.businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    action: "media.delete",
    resourceType: "media",
    resourceId: id,
    metadata: { kind: media.kind },
    requestId: c.requestId,
  });
  return json({ ok: true, scheduledPurge: true });
}

/**
 * Public media read. Approved images are cacheable forever; unapproved ones are
 * only visible to the owning workspace (checked by membership, not by a flag in
 * the URL), and R2 keys are never exposed.
 */
export async function serveMedia(c: AppContext): Promise<Response> {
  const id = c.params["mediaId"] ?? "";
  const media = await DB.first<{
    id: string;
    r2_key: string;
    content_type: string;
    moderation_status: string;
    business_id: string;
    alt: string;
  }>(
    c.env,
    "SELECT id, r2_key, content_type, moderation_status, business_id, alt FROM media WHERE id = ? AND deleted_at IS NULL",
    [id],
  );
  if (!media) throw ApiError.notFound("Image not found.");
  const isPublic = media.moderation_status === "approved";
  if (!isPublic) {
    const business = await DB.first<{
      id: string;
      name: string;
      slug: string;
      status: string;
      plan: "free" | "growth" | "pro";
      owner_user_id: string | null;
    }>(c.env, "SELECT id, name, slug, status, plan, owner_user_id FROM businesses WHERE id = ?", [
      media.business_id,
    ]);
    if (!business) throw ApiError.notFound("Image not found.");
    // `access()` resolves the tenant from the URL's :businessId, which this route does not
    // have — so it always failed, which meant an owner could not preview their own pending
    // image either. Authorise against the business the row belongs to instead.
    await requireAccess(c, media.business_id, "profile:read");
  }
  const object = await c.env.MEDIA.get(media.r2_key);
  if (!object) {
    // Metadata outliving the object is an operational fault, not a user error.
    c.log("warn", "media_object_missing", { mediaId: media.id });
    throw ApiError.notFound("Image is temporarily unavailable.");
  }
  const headers = mediaHeaders(object.httpMetadata?.contentType || media.content_type);
  headers.set("content-disposition", `inline; filename="${media.id}"`);
  headers.set("content-length", String(object.size ?? 0));
  return new Response(object.body, { status: 200, headers });
}
