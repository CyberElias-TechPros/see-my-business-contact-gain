import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

/**
 * Tests for the GainHub API run inside the real Workers runtime (workerd via the Vitest
 * Cloudflare plugin), against D1/KV/R2 simulators that `wrangler dev` uses locally. That
 * matters: `node --test`-style tests would have missed every WebCrypto/Crypto-ISO8601/
 * `caches` difference this Worker has already hit, and the D1 simulator enforces the same
 * CHECK constraints and triggers production does — which is how the derived-count
 * assertions in worker/test/api.test.ts actually prove something.
 *
 * Two layers on purpose:
 *   worker/test/logic.test.ts  — domain rules, no bindings (fast, deterministic)
 *   worker/test/api.test.ts    — real HTTP against a migrated D1 (authorisation, triggers,
 *                                rate limits, CSRF, derived aggregates)
 * The end-to-end product journey lives in worker/dev/smoke.mjs, which runs against a
 * *deployed-or-local* API rather than a fixture, so the two suites do not duplicate.
 */
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.test.jsonc" } })],
  test: {
    include: ["worker/test/**/*.test.ts"],
    // Storage is isolated per test *file*, and miniflare's D1 is rebuilt from migrations in
    // `beforeAll`; a shared global setup would only hide ordering bugs.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
