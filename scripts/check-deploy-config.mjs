#!/usr/bin/env node
/**
 * Deployment config guard.
 *
 * `wrangler deploy` is silent about half-configured production: it happily ships a Worker
 * pointed at a local dev D1, a KV namespace that does not exist, `APP_ENV=development` on
 * the public internet, or a `PUBLIC_URL` that no cookie will ever match. Every one of those
 * produced a bug in this project's history, so they are now checked before a deploy is
 * allowed to be attempted.
 *
 * `node scripts/check-deploy-config.mjs` (also run by `npm run worker:deploy` through CI)
 * exits non-zero with a list of problems. Use `--allow-dev-ids` for the first staging
 * deploy, when the real resource ids do not exist yet.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowDevIds = process.argv.includes("--allow-dev-ids");
const problems = [];
const notes = [];

/** Minimal JSONC reader: strips comments and trailing commas, then parses. */
function readJsonc(path) {
  const text = readFileSync(path, "utf8");
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1")
    .replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(stripped);
  } catch (error) {
    problems.push(`${path} is not valid JSONC after comment stripping: ${error.message}`);
    return {};
  }
}

const configPath = join(root, "worker/wrangler.jsonc");
const config = readJsonc(configPath);
const envTypes = readFileSync(join(root, "worker/env.d.ts"), "utf8");
const gitignore = (() => {
  try {
    return readFileSync(join(root, ".gitignore"), "utf8");
  } catch {
    return "";
  }
})();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The ids `wrangler d1 create`/`kv namespace create` printed for this project's dev copies. */
const DEV_IDS = new Set(
  [
    "00000000-0000-4000-8000-0000000000d1",
    "00000000-0000-4000-8000-00000000006b",
    "00000000-0000-4000-8000-0000000000c1",
  ].concat(
    // any generated placeholder of the form 00000000-… is dev-only by construction
    [],
  ),
);

function checkEnv(name, cfg) {
  const vars = cfg.vars ?? {};
  if (vars.APP_ENV !== name) {
    problems.push(
      `${name === "production" ? "top level" : `env.${name}`}: vars.APP_ENV is "${vars.APP_ENV}" but must be "${name}" — the API's cache, rate-limit and debug behaviour switch on it.`,
    );
  }
  for (const secret of ["SECRET_KEY", "RESEND_API_KEY", "MAIL_FROM", "DATABASE_URL"]) {
    if (secret in vars) {
      problems.push(
        `${name}: vars.${secret} is set in wrangler.jsonc. Secrets must be stored with \`wrangler secret put ${name === "production" ? "" : `--env ${name} `}${secret}\` — anything here is committed to the repository.`,
      );
    }
  }
  for (const key of ["PUBLIC_URL", "API_URL"]) {
    const value = vars[key];
    if (typeof value !== "string" || value.length === 0) {
      problems.push(
        `${name}: vars.${key} is required (emails, canonical URLs and redirects are built from it).`,
      );
      continue;
    }
    let url;
    try {
      url = new URL(value);
    } catch {
      problems.push(`${name}: vars.${key} = "${value}" is not an absolute URL.`);
      continue;
    }
    if (name !== "development" && url.protocol !== "https:") {
      problems.push(
        `${name}: vars.${key} must be https (the session cookie is Secure, so http would silently log users out).`,
      );
    }
    if (
      key === "PUBLIC_URL" &&
      /localhost|127\.0\.0\.1/.test(url.hostname) &&
      name !== "development"
    ) {
      problems.push(
        `${name}: vars.PUBLIC_URL points at ${url.hostname}; every link in a transactional email would be dead.`,
      );
    }
  }
  const cookieDomain = vars.COOKIE_DOMAIN;
  if (name !== "development" && cookieDomain && !/^[a-z0-9.-]+$/i.test(cookieDomain)) {
    problems.push(
      `${name}: vars.COOKIE_DOMAIN = "${cookieDomain}" is not a bare host or domain (no scheme, no port).`,
    );
  }
  if (name === "production" && vars.ALLOWED_ORIGINS) {
    for (const origin of String(vars.ALLOWED_ORIGINS)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (!/^https:\/\//.test(origin)) {
        problems.push(
          `production: ALLOWED_ORIGINS entry "${origin}" is not https — credentialed CORS would be refused by browsers anyway.`,
        );
      }
    }
  }
  return vars;
}

// ---- routes / domains -------------------------------------------------------
const routes = Array.isArray(config.routes) ? config.routes : [];
if (routes.length === 0) {
  notes.push(
    "No `routes` yet: the Worker is reachable only at its *.workers.dev hostname. Add a custom domain before go-live.",
  );
}
for (const route of routes) {
  if (!route || typeof route !== "object") {
    problems.push(`routes: expected an object, got ${JSON.stringify(route)}`);
    continue;
  }
  const host = route.custom_domain?.name ?? route.pattern;
  if (host && !/^[a-z0-9.-]+$/i.test(String(host).replace(/^https?:\/\//, ""))) {
    problems.push(`routes: "${host}" is not a plain hostname.`);
  }
}

// ---- resources --------------------------------------------------------------
function checkResources(cfg, label) {
  for (const db of cfg.d1_databases ?? []) {
    if (!db.binding) problems.push(`${label}: a d1_database has no binding.`);
    if (!UUID.test(String(db.database_id))) {
      problems.push(
        `${label}: d1 "${db.database_name}" has database_id "${db.database_id}" — it must be the UUID from \`wrangler d1 create\`.`,
      );
    } else if (!allowDevIds && DEV_IDS.has(db.database_id)) {
      problems.push(
        `${label}: d1 "${db.database_name}" still uses a local dev id. Run \`wrangler d1 create\` and paste the real id, or pass --allow-dev-ids for staging.`,
      );
    }
    if (db.migrations_dir && !resolve(root, "worker", db.migrations_dir).includes("worker")) {
      problems.push(
        `${label}: d1 "${db.database_name}" migrations_dir "${db.migrations_dir}" escapes worker/.`,
      );
    }
  }
  for (const kv of cfg.kv_namespaces ?? []) {
    if (!UUID.test(String(kv.id)))
      problems.push(`${label}: kv "${kv.binding}" has id "${kv.id}" — not a namespace id.`);
    else if (!allowDevIds && DEV_IDS.has(kv.id))
      problems.push(`${label}: kv "${kv.binding}" still uses a local dev namespace id.`);
  }
  for (const bucket of cfg.r2_buckets ?? []) {
    if (!bucket.bucket_name)
      problems.push(`${label}: r2 bucket "${bucket.binding}" has no bucket_name.`);
    if (bucket.bucket_name?.includes("_dev") && label === "production") {
      problems.push(
        `${label}: r2 bucket "${bucket.bucket_name}" looks like a dev bucket — production media must not share it.`,
      );
    }
  }
  for (const queue of [...(cfg.queues?.producers ?? []), ...(cfg.queues?.consumers ?? [])]) {
    if (!queue.queue) problems.push(`${label}: a queue entry has no \`queue\` name.`);
  }
  const consumers = cfg.queues?.consumers ?? [];
  if (consumers.length > 0 && !consumers.some((q) => q.max_batch_size && q.max_batch_size <= 50)) {
    notes.push(
      `${label}: queue consumer max_batch_size should stay small (≤25) — the Workers queue batch limit is 50 messages.`,
    );
  }
  if (cfg.main) {
    try {
      readFileSync(resolve(root, "worker", cfg.main), "utf8");
    } catch {
      problems.push(`${label}: main "${cfg.main}" does not resolve to a file.`);
    }
  }
  const migrationsDir = (cfg.d1_databases ?? [])[0]?.migrations_dir;
  if (migrationsDir) {
    const dir = resolve(root, "worker", migrationsDir);
    if (!existsSync(dir)) {
      problems.push(`${label}: migrations_dir "${migrations_dir}" does not exist.`);
    }
    const listing = readdirSync(dir).filter((f) => f.endsWith(".sql"));
    if (listing.length === 0)
      problems.push(`${label}: ${migrationsDir} contains no .sql migrations.`);
    const badNames = listing.filter((f) => !/^\d{4}_.+\.sql$/.test(f));
    if (badNames.length > 0) {
      problems.push(
        `${label}: migration files must be named NNNN_name.sql so D1 applies them in order — ${badNames.join(", ")}.`,
      );
    }
    const declared = (readFileSync(configPath, "utf8").match(/"tag":\s*"([^"]+)"/g) ?? []).map(
      (s) => s.split('"')[3],
    );
    const gaps = listing.filter((f) => !declared.includes(f.replace(/\.sql$/, "")));
    if (gaps.length > 0 && declared.length > 0) {
      problems.push(
        `${label}: migrations not listed in wrangler.jsonc "migrations" would never be applied remotely: ${gaps.join(", ")}.`,
      );
    }
  }
}

function checkAccount(cfg, label) {
  const id = cfg.account_id;
  if (!id) {
    notes.push(
      `${label}: no account_id — wrangler will use the logged-in account, which makes CI deploys ambiguous.`,
    );
  } else if (!/^[0-9a-f]{32}$/.test(String(id))) {
    problems.push(`${label}: account_id "${id}" is not a 32-hex-char Cloudflare account id.`);
  }
}

checkEnv("production", config);
checkResources(config, "production");
checkAccount(config, "production");

if (config.env?.staging) {
  checkEnv("staging", config.env.staging);
  checkResources(config.env.staging, "staging");
  const shared = new Set([
    ...(config.d1_databases ?? []).map((d) => d.database_id),
    ...(config.kv_namespaces ?? []).map((k) => k.id),
  ]);
  for (const db of config.env.staging.d1_databases ?? []) {
    if (shared.has(db.database_id))
      problems.push(
        `staging: D1 "${db.database_name}" reuses the production database id — staging must never write to production data.`,
      );
  }
  for (const kv of config.env.staging.kv_namespaces ?? []) {
    if (shared.has(kv.id))
      problems.push(`staging: KV "${kv.binding}" reuses a production namespace.`);
  }
  if (
    (config.env.staging.r2_buckets ?? []).some((b) =>
      (config.r2_buckets ?? []).some((p) => p.bucket_name === b.bucket_name),
    )
  ) {
    problems.push(
      "staging: the R2 bucket is shared with production — media uploads would mix tenants.",
    );
  }
} else {
  notes.push("No env.staging: there is no non-production place to rehearse a deploy.");
}

// ---- secrets hygiene --------------------------------------------------------
if (!/\.dev\.vars/.test(gitignore)) {
  problems.push(
    ".gitignore does not ignore worker/.dev.vars — local secrets would be committed by accident.",
  );
}
try {
  const devVars = readFileSync(join(root, "worker/.dev.vars"), "utf8");
  const inline = devVars.match(/^([A-Z_]+)\s*=\s*"([^"]*)"/gm) ?? [];
  const weak = inline.filter(
    (line) =>
      line.includes("RESEND_API_KEY") && /re_resend_api_key_here|changeme|your[-_]key/i.test(line),
  );
  for (const line of weak)
    notes.push(
      `worker/.dev.vars still contains a placeholder (${line.split("=")[0].trim()}); transactional mail will be logged instead of sent.`,
    );
  void devVars;
} catch {
  notes.push(
    "worker/.dev.vars is absent — copy worker/.dev.vars.example to worker/.dev.vars before running the API locally.",
  );
}

// ---- env.d.ts vs wrangler.jsonc --------------------------------------------
const declaredBindings = [
  ...(config.d1_databases ?? []).map((d) => d.binding),
  ...(config.kv_namespaces ?? []).map((k) => k.binding),
  ...(config.r2_buckets ?? []).map((b) => b.binding),
  ...(config.queues?.producers ?? []).map((q) => q.binding),
  ...Object.keys(config.vars ?? {}),
];
for (const binding of declaredBindings) {
  if (!new RegExp(`\\b${binding}\\??:`).test(envTypes)) {
    problems.push(
      `worker/env.d.ts has no entry for the "${binding}" binding — code reading it would be typed \`any\` or fail to compile. Run \`npm run cf:typegen\`.`,
    );
  }
}

for (const note of notes) console.log(`note: ${note}`);
if (problems.length > 0) {
  console.error(`${problems.length} deployment config problem(s):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(
  `wrangler.jsonc passed ${declaredBindings.length} binding checks${notes.length ? ` (${notes.length} note(s))` : ""}.`,
);
