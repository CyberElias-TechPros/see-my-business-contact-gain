/**
 * Vite's `?raw` import suffix, used by the test suite to build a database from the same
 * migration files `wrangler d1 migrations apply` runs in production. If this import ever
 * stops resolving, the API tests would be testing an empty schema — they fail loudly
 * instead, because `beforeAll` asserts on the seeded rows.
 */
declare module "*.sql?raw" {
  const content: string;
  export default content;
}
