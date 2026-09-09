import {
  PLAN_LIMITS,
  type BusinessPlan,
  type WorkspacePermission,
} from "../../../shared/domain.ts";
import { requireAccess, type BusinessAccess } from "../auth.ts";
import { DB } from "../db-access.ts";
import { ApiError } from "../errors.ts";
import type { AppContext } from "../types.ts";

/**
 * Workspace endpoints resolve authorization one way: the business id comes from
 * the URL, the role comes from the database, the permission is checked before any
 * tenant row is touched. Nothing here trusts a header, cookie or client hint.
 */
export async function access(
  c: AppContext,
  permission?: WorkspacePermission,
): Promise<BusinessAccess> {
  const ref = c.params["businessId"];
  if (!ref)
    throw ApiError.validation({ businessId: "A business id is required for workspace endpoints." });
  return requireAccess(c, ref, permission);
}

/** Plan quotas are enforced server-side; the UI only mirrors them for UX. */
export async function assertWithinPlan(
  c: AppContext,
  businessId: string,
  resource: keyof (typeof PLAN_LIMITS)["free"],
  nextCount: number,
): Promise<void> {
  const row = await DB.first<{ plan: BusinessPlan }>(
    c.env,
    "SELECT plan FROM businesses WHERE id = ?",
    [businessId],
  );
  const plan = row?.plan ?? "free";
  const limit = PLAN_LIMITS[plan][resource];
  if (nextCount > limit) {
    throw ApiError.domain(
      `The ${plan} plan allows ${limit} ${resource.replace(/s$/, "")}${limit === 1 ? "" : "s"}. Upgrade to add more.`,
      { plan: `Upgrade for more ${resource.replace(/_/g, " ")}` },
    );
  }
}

export async function countRows(c: AppContext, sql: string, params: unknown[]): Promise<number> {
  return DB.count(c.env, sql, params);
}

/**
 * The signed-in user's own listing, used by endpoints that create tenant-owned
 * rows on the user's behalf (rooms, claims) where the URL carries no business id.
 * Membership rows win; the legacy `owner_user_id` link is the fallback.
 */
export async function myBusiness(c: AppContext): Promise<MyBusiness | null> {
  const userId = c.session?.user.id;
  if (!userId) return null;
  const row = await DB.first<MyBusiness>(
    c.env,
    `SELECT b.id, b.name, b.slug, b.status, b.plan, b.verified_level AS verification_level, m.role AS membership_role, b.owner_user_id
       FROM businesses b
       LEFT JOIN memberships m ON m.business_id = b.id AND m.user_id = ? AND m.status = 'active'
      WHERE m.user_id IS NOT NULL OR b.owner_user_id = ?
      ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, b.updated_at DESC
      LIMIT 1`,
    [userId, userId],
  );
  return row ?? null;
}

export type MyBusiness = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: BusinessPlan;
  verification_level: string;
  membership_role: string | null;
  owner_user_id: string | null;
};
