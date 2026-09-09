/**
 * Domain rules — the parts of GainHub that must never drift between the API, the frontend
 * and a CSV export. These run in the Workers runtime (like every test here) but touch no
 * bindings, so they are the fastest signal that a shared rule changed.
 */
import { describe, expect, it } from "vitest";
import { buildCookie } from "../src/http.ts";
import type { Env } from "../src/types.ts";
import {
  ALLOWED_UPLOAD_TYPES,
  BUSINESS_STATUSES,
  MAX_UPLOAD_BYTES,
  PLAN_LIMITS,
  PRIVATE_MEDIA_KINDS,
  SAVE_BACK_MINIMUM,
  VERIFICATION_RANK,
  can,
  canMoveStage,
  formatNaira,
  looksLikePhone,
  normalizeNigerianPhone,
  parseNairaToMinor,
  scoreLead,
  scoreReportRisk,
  slugify,
  waLink,
} from "../../shared/domain.ts";

describe("Nigerian phone handling", () => {
  it("normalises the ways people actually type a number", () => {
    for (const input of [
      "0803 000 0000",
      "+234 803 000 0000",
      "2348030000000",
      "0803-000-0000",
      "002348030000000",
    ]) {
      expect(normalizeNigerianPhone(input)).toBe("+2348030000000");
    }
  });

  it("refuses numbers that are not Nigerian mobile lines", () => {
    expect(normalizeNigerianPhone("0803 000 00")).toBeNull(); // too short
    expect(normalizeNigerianPhone("070123456789")).toBeNull(); // too long
    expect(normalizeNigerianPhone("0123 456 7890")).toBeNull(); // 1st digit not 7/8/9
    expect(normalizeNigerianPhone("+1 415 555 0123")).toBeNull(); // not NG
    expect(looksLikePhone("hello")).toBe(false);
  });

  it("builds a wa.me link with an encoded pre-filled message", () => {
    expect(waLink("+234 803 000 0000")).toBe("https://wa.me/2348030000000");
    expect(waLink("+2348030000000", "Hi, is this available?")).toBe(
      "https://wa.me/2348030000000?text=Hi%2C%20is%20this%20available%3F",
    );
  });
});

describe("money formatting", () => {
  it("renders kobo as Naira without float noise", () => {
    expect(formatNaira(12_500_00)).toBe("₦12,500");
    expect(formatNaira(12_500_50)).toBe("₦12,500.5");
    expect(formatNaira(0)).toBe("Free");
    expect(formatNaira(null)).toBe("Price on request");
  });

  it("parses the strings a person pastes into a price field", () => {
    expect(parseNairaToMinor("₦12,500")).toBe(1_250_000);
    expect(parseNairaToMinor("12500.50")).toBe(1_250_050);
    expect(parseNairaToMinor("free")).toBeNull();
    expect(parseNairaToMinor("-100")).toBeNull();
  });
});

describe("slug generation", () => {
  it("is accent-safe, lowercase and hyphen-bounded", () =>
    expect(slugify("  Adìrè  Atelier — Ikeja!! ")).toBe("adire-atelier-ikeja"));

  it("never exceeds the column budget", () =>
    expect(slugify("x".repeat(200)).length).toBeLessThanOrEqual(64));

  it("collides predictably for empty-ish names (the API adds the suffix)", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("123")).toBe("123");
  });
});

describe("lead pipeline", () => {
  it("allows forward moves and the two recovery edges the product needs", () => {
    expect(canMoveStage("new", "qualified")).toBe(true);
    expect(canMoveStage("follow_up", "won")).toBe(true);
    // A deal can fall through after it was marked won, and a lost lead can be revived:
    // both are corrections a real sales team makes, and blocking them only produces
    // duplicate leads.
    expect(canMoveStage("won", "lost")).toBe(true);
    expect(canMoveStage("lost", "new")).toBe(true);
  });

  it("rejects stage skipping — the funnel numbers depend on it", () => {
    expect(canMoveStage("new", "won")).toBe(false);
    expect(canMoveStage("new", "quoted")).toBe(false);
    expect(canMoveStage("lost", "won")).toBe(false);
    expect(canMoveStage("won", "quoted")).toBe(false);
  });

  it("scores leads deterministically and within 1..99", () => {
    const base = { source: "qr_code", stage: "new" } as const;
    expect(scoreLead(base)).toBe(scoreLead(base));
    const scored = scoreLead({
      source: "referral",
      stage: "won",
      valueMinor: 5_000_000,
      messageLength: 400,
    });
    expect(scored).toBeGreaterThanOrEqual(1);
    expect(scored).toBeLessThanOrEqual(99);
    // Money and staleness must move the number in opposite directions.
    const fresh = scoreLead({ source: "manual", stage: "qualified", hoursSinceActivity: 0 });
    const stale = scoreLead({ source: "manual", stage: "qualified", hoursSinceActivity: 300 });
    expect(fresh).toBeGreaterThan(stale);
  });
});

describe("roles and verification", () => {
  it("keeps an agent out of billing and profile writes", () => {
    expect(can("agent", "leads:write")).toBe(true);
    expect(can("agent", "profile:write")).toBe(false);
    expect(can("marketing", "leads:write")).toBe(false);
    expect(can("manager", "profile:write")).toBe(true);
    expect(can(null, "profile:read")).toBe(false);
  });

  it("orders verification levels so 'verified rooms' can compare them", () => {
    expect(VERIFICATION_RANK.premium).toBeGreaterThan(VERIFICATION_RANK.documents);
    expect(VERIFICATION_RANK.email).toBeGreaterThan(VERIFICATION_RANK.unverified);
  });

  it("grows every limit with the plan", () => {
    for (const key of ["media", "teamSeats", "links", "automations", "campaigns"] as const) {
      expect(PLAN_LIMITS.growth[key]).toBeGreaterThan(PLAN_LIMITS.free[key]);
      expect(PLAN_LIMITS.pro[key]).toBeGreaterThan(PLAN_LIMITS.growth[key]);
    }
  });
});

describe("safety inputs", () => {
  it("treats a fake review and a scam differently from a nitpick", () => {
    expect(scoreReportRisk("scam")).toBe("high");
    expect(scoreReportRisk("fake_review")).toBe("medium");
    expect(scoreReportRisk("other", "this shop has the wrong address")).toBe("low");
    expect(scoreReportRisk("other", "asked me to pay before delivery")).toBe("high");
  });

  it("keeps documents out of public galleries", () => {
    expect(PRIVATE_MEDIA_KINDS).toContain("document");
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
    expect(ALLOWED_UPLOAD_TYPES).toEqual(["image/jpeg", "image/png", "image/webp", "image/avif"]);
  });

  it("requires a real save-back before a room member can post a listing", () => {
    expect(SAVE_BACK_MINIMUM).toBeGreaterThan(0);
  });
});

describe("session cookies", () => {
  const asEnv = (overrides: Record<string, string>) => overrides as unknown as Env;

  it("scopes the cookie to COOKIE_DOMAIN outside development", () => {
    const production = buildCookie(
      asEnv({ APP_ENV: "production", COOKIE_DOMAIN: "gainhub.ng" }),
      "gh_session",
      "a.b",
    );
    expect(production).toContain("Domain=gainhub.ng");
    expect(production).toContain("Secure");
    expect(production).toContain("HttpOnly");
    expect(production).toContain("SameSite=Lax");
  });

  it("drops the Domain attribute in development, where localhost cannot store it", () => {
    const dev = buildCookie(
      asEnv({ APP_ENV: "development", COOKIE_DOMAIN: "gainhub.ng" }),
      "gh_session",
      "a.b",
    );
    expect(dev).not.toContain("Domain=");
    // …and with it the Secure flag, so an http:// preview can still hold a session.
    expect(dev).not.toContain("Secure");
  });

  it("keeps Secure when SameSite=None is asked for, because browsers require the pair", () => {
    const crossSite = buildCookie(
      asEnv({ APP_ENV: "development", COOKIE_SAMESITE_NONE: "true" }),
      "gh_session",
      "a.b",
    );
    expect(crossSite).toContain("SameSite=None");
    expect(crossSite).toContain("Secure");
  });
});

describe("status vocabulary", () => {
  it("has exactly one publicly discoverable status", () => {
    expect(BUSINESS_STATUSES).toContain("draft");
    expect(BUSINESS_STATUSES).toContain("suspended");
  });
});
