/**
 * The open-redirect guard, tested as the security control it is.
 *
 * `?next=` is attacker-supplied by construction — it arrives from a link in an email, a bookmark,
 * or the address bar — so "we only put sensible values there" is not a defence. Each case below is
 * a way a naive `if (next.startsWith("/"))` or a `URL(next, location.origin)` would still leave the
 * app forwarding a signed-in visitor (and their freshly typed credentials) to another host.
 */
import { describe, expect, it } from "vitest";

import { AUTH_RETURN_FALLBACK, safeNext } from "./safe-next.ts";

const fallback = AUTH_RETURN_FALLBACK;

describe("safeNext", () => {
  it("keeps the internal paths the app actually generates", () => {
    expect(safeNext("/app")).toBe("/app");
    expect(safeNext("/app/leads")).toBe("/app/leads");
    expect(safeNext("/account")).toBe("/account");
    // Its own query string survives: /claim hands over ?next=/app/claim?tab=pending.
    expect(safeNext("/search?q=plumber&page=2")).toBe("/search?q=plumber&page=2");
    expect(safeNext("/business/crown-labs#reviews")).toBe("/business/crown-labs#reviews");
  });

  it("rejects anything that could leave the origin", () => {
    const hostile = [
      "https://evil.example",
      "http://evil.example/app",
      "//evil.example", // protocol-relative: browser keeps our scheme, swaps the host
      "///evil.example",
      "/\\evil.example", // backslash: some engines normalise this to //host
      "\\evil.example",
      "javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "/app\t.evil.example", // control characters hidden inside a path
      "/app\nSet-Cookie: x=1",
      " /app",
      "/../etc/passwd",
    ];
    for (const value of hostile) {
      expect(safeNext(value), value).toBe(fallback);
    }
  });

  it("refuses to bounce a signed-in visitor back to the auth page", () => {
    // /auth?next=/auth would otherwise loop until someone closes the tab.
    expect(safeNext("/auth")).toBe(fallback);
    expect(safeNext("/auth?mode=signup")).toBe(fallback);
    expect(safeNext("/AUTH/../app")).toBe(fallback);
    expect(safeNext("/login")).toBe(fallback);
    expect(safeNext("/signup")).toBe(fallback);
  });

  it("treats a missing or absurd value as no value", () => {
    expect(safeNext(undefined)).toBe(fallback);
    expect(safeNext("")).toBe(fallback);
    expect(safeNext("/a".repeat(300))).toBe(fallback);
  });

  it("does not let a trailing slash or case trick turn /app into a loop", () => {
    expect(safeNext("/app/")).toBe("/app/");
    expect(safeNext("/app/claim")).toBe("/app/claim");
  });
});
