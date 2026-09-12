import { describe, expect, it } from "vitest";
import {
  directoryQuerySchema,
  enquirySchema,
  listingApplicationSchema,
  loginSchema,
  passwordSchema,
  reportSchema,
} from "../src/lib/contracts";
import { constantTimeEqual, escapeLike, normalizeEmail, normalizePhone } from "../worker/index";

describe("directory query contract", () => {
  it("normalizes defaults without treating the string false as true", () => {
    const query = directoryQuerySchema.parse({ verified: "false", openNow: "0", page: "2" });
    expect(query).toMatchObject({ verified: false, openNow: false, page: 2, pageSize: 12 });
  });

  it("caps page size and rejects unknown sort values", () => {
    expect(directoryQuerySchema.safeParse({ pageSize: 25 }).success).toBe(false);
    expect(directoryQuerySchema.safeParse({ sort: "nearest" }).success).toBe(false);
  });
});

describe("public submission contracts", () => {
  it("requires explicit enquiry consent and meaningful detail", () => {
    const result = enquirySchema.safeParse({
      businessId: "11111111-1111-4111-8111-111111111111",
      name: "Ada Okafor",
      phone: "+234 801 234 5678",
      message: "Too short",
      consent: false,
    });
    expect(result.success).toBe(false);
  });

  it("uses a honeypot and requires listing terms", () => {
    const result = listingApplicationSchema.safeParse({
      ownerName: "Ada Okafor",
      email: "ada@example.com",
      businessName: "Ada Repairs",
      tagline: "Phone repairs in central Lagos",
      categorySlug: "phone-gadgets",
      locationSlug: "lagos",
      address: "12 Example Road, Ikeja",
      whatsapp: "+2348012345678",
      phone: "",
      website: "",
      about: "A sufficiently complete description of a local repair business and its service area.",
      acceptedTerms: true,
      company: "bot-filled-field",
    });
    expect(result.success).toBe(false);
  });

  it("restricts report reasons and target types", () => {
    expect(
      reportSchema.safeParse({
        targetType: "database",
        targetId: "example",
        reason: "revenge",
        details: "This is enough detail to pass the minimum length check.",
      }).success,
    ).toBe(false);
  });
});

describe("authentication contracts", () => {
  it("requires a strong minimum password shape", () => {
    expect(passwordSchema.safeParse("shortpassword").success).toBe(false);
    expect(passwordSchema.safeParse("A-longer-password-2026").success).toBe(true);
  });

  it("never accepts an empty login password", () => {
    expect(loginSchema.safeParse({ identity: "ada@example.com", password: "" }).success).toBe(
      false,
    );
  });
});

describe("worker normalization and comparison helpers", () => {
  it("normalizes Nigerian local phone numbers to E.164", () => {
    expect(normalizePhone("0801 234 5678")).toBe("+2348012345678");
    expect(normalizePhone("+234 (801) 234-5678")).toBe("+2348012345678");
  });

  it("normalizes email case and whitespace", () => {
    expect(normalizeEmail("  ADA@Example.COM ")).toBe("ada@example.com");
  });

  it("escapes SQL LIKE metacharacters", () => {
    expect(escapeLike("50%_off\\today")).toBe("50\\%\\_off\\\\today");
  });

  it("compares complete values rather than prefixes", () => {
    expect(constantTimeEqual("same-value", "same-value")).toBe(true);
    expect(constantTimeEqual("same-value", "same-value-extra")).toBe(false);
    expect(constantTimeEqual("same-value", "same-valuf")).toBe(false);
  });
});
