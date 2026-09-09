#!/usr/bin/env node
/**
 * Guard: the committed lockfile must match package.json.
 *
 * Vercel (and any CI that respects `bun.lock`) installs with `bun install --frozen-lockfile`,
 * which refuses to resolve anything the lockfile does not already contain. When a dependency is
 * added to package.json without re-running the install — trivial to do in a sandbox or a branch
 * that uses npm instead — the deployment dies in seconds with "error: lockfile had changes, but
 * lockfile is frozen" and no hint about *which* package. That is exactly how this repo's first
 * Vercel build failed: `vitest`, `wrangler`, `@cloudflare/vitest-plugin` and
 * `@cloudflare/workers-types` were in package.json and not in bun.lock.
 *
 * So: check it here, where the failure names the package and points at the fix.
 *
 * Both lockfile formats are handled because development is allowed with either PM (docs mention
 * `npm install --legacy-peer-deps` for environments without bun); the file that exists is the one
 * that ships.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

/** Direct dependency names + the exact range string, the unit a lockfile must agree on. */
const wanted = Object.assign({}, pkg.dependencies ?? {}, pkg.devDependencies ?? {});
const names = Object.keys(wanted).sort();
if (names.length === 0) {
  console.error("check:lock — package.json has no dependencies, which cannot be right.");
  process.exit(1);
}

const problems = [];

if (existsSync(resolve(root, "bun.lock"))) {
  checkBunLock(readFileSync(resolve(root, "bun.lock"), "utf8"));
} else if (existsSync(resolve(root, "package-lock.json"))) {
  checkNpmLock(readFileSync(resolve(root, "package-lock.json"), "utf8"));
} else {
  problems.push(
    "no bun.lock or package-lock.json is committed, so every install resolves independently — run `bun install` (or `npm install --legacy-peer-deps`) and commit the lockfile.",
  );
}

function checkBunLock(text) {
  // bun's text lock is JSON with trailing commas, so it is matched structurally rather than
  // parsed: `"packages"` lists every resolved package as `"name": ["name@version", …]`, and the
  // workspace block repeats the ranges from package.json.
  const resolved = new Set();
  for (const match of text.matchAll(/^ {4}"((?:@[^/"]+\/)?[^"/]+)": \[/gm)) {
    resolved.add(match[1]);
  }
  const workspaceRanges = new Map();
  const workspaceBlock = text.slice(text.indexOf('"workspaces"'), text.indexOf('"packages"'));
  for (const match of workspaceBlock.matchAll(/^ {8}"((?:@[^/"]+\/)?[^"/]+)": "([^"]+)",?$/gm)) {
    workspaceRanges.set(match[1], match[2]);
  }

  for (const name of names) {
    if (!resolved.has(name)) {
      problems.push(`${name}@${wanted[name]} is required by package.json but absent from bun.lock`);
      continue;
    }
    const locked = workspaceRanges.get(name);
    if (locked !== undefined && locked !== wanted[name]) {
      problems.push(
        `${name}: package.json wants "${wanted[name]}" but bun.lock records "${locked}"`,
      );
    }
  }
  if (resolved.size === 0)
    problems.push("bun.lock has no packages section — is it a real lockfile?");
}

function checkNpmLock(text) {
  let lock;
  try {
    lock = JSON.parse(text);
  } catch {
    problems.push("package-lock.json is not valid JSON");
    return;
  }
  const rootPkg = lock.packages?.[""] ?? {};
  const lockedDeps = Object.assign({}, rootPkg.dependencies ?? {}, rootPkg.devDependencies ?? {});
  for (const name of names) {
    if (!lockedDeps[name]) {
      problems.push(
        `${name}@${wanted[name]} is required by package.json but absent from package-lock.json`,
      );
    } else if (lockedDeps[name] !== wanted[name]) {
      problems.push(
        `${name}: package.json wants "${wanted[name]}" but package-lock.json records "${lockedDeps[name]}"`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`check:lock — ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    "\nFix: run `bun install` (or `npm install --legacy-peer-deps`) and commit the updated lockfile.",
  );
  console.error("Vercel installs with --frozen-lockfile, so CI fails without that commit.");
  process.exit(1);
}

console.log(`check:lock — ${names.length} direct dependencies match the committed lockfile.`);
