/**
 * Static SQL validator.
 *
 * The Worker builds SQL as template strings, so `tsc` cannot see into them: a typo in a
 * column name, a missing table alias, an INSERT whose value list is one item longer than
 * its column list — all of those compile cleanly and fail at request time. Several did.
 *
 * This script builds a real SQLite database from `worker/migrations/*.sql`, resolves the
 * SQL fragments held in file-level constants, then prepares every statement it can
 * reconstruct against that schema. Statements whose text depends on runtime values
 * (`${sets.join(", ")}`) are counted as dynamic and skipped rather than guessed at, so the
 * output stays worth reading. `worker/dev/seed.sql` is executed end-to-end for the same
 * reason: trigger-maintained aggregates and CHECK constraints should not drift silently.
 *
 *   node scripts/check-sql.mjs          # npm run check:sql, also runs in CI
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WORKER = join(ROOT, "worker");
const VERBOSE = process.argv.includes("--verbose");

function tsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

const db = new DatabaseSync(":memory:");
for (const file of readdirSync(join(WORKER, "migrations")).sort()) {
  db.exec(readFileSync(join(WORKER, "migrations", file), "utf8"));
}
const TABLES = new Set(
  db
    .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view')")
    .all()
    .map((row) => String(row.name)),
);

const DYNAMIC = "\u0001";

/** `const NAME = "…"` / `` `…` `` at file scope — the SQL fragments statements interpolate. */
function constantMap(source) {
  const map = new Map();
  for (const match of source.matchAll(
    /^const ([A-Z][A-Z0-9_]*)\s*(?::[^=]+)?=\s*(?:`([^`]*)`|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/gm,
  )) {
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    map.set(match[1], value.replace(/\s+/g, " ").trim());
  }
  return map;
}

function unquote(text, isTemplate) {
  return isTemplate ? text : text.replace(/\\(["'\\])/g, "$1");
}

function looksLikeSql(text) {
  const head = text.replace(/^\s+/, "").slice(0, 40).toLowerCase();
  if (
    /^(select|with|insert into|delete from|update|create (table|index|unique|view)|drop (table|index|view)|pragma)\b/.test(
      head,
    ) === false
  )
    return false;
  // Prose that merely starts with a SQL verb ("Update on your application") is not SQL.
  if (head.startsWith("update") && /\bset\b/i.test(text) === false) return false;
  if (head.startsWith("insert into") && /\bvalues\b|\bselect\b/i.test(text) === false) return false;
  return true;
}

/**
 * Rewrites `${…}` holes. Constants defined in the same file are inlined, so
 * `SELECT ${LEAD_SELECT} ${LEAD_FROM} …` becomes one complete statement. Everything else
 * (request-derived fragments) is filled with a small set of plausible fragments — the
 * statement is still worth preparing, and the surrounding text is where aliases live.
 */
function fill(text, constants) {
  const unknown = [];
  const filled = text.replace(/\$\{([^{}]*)\}/g, (_full, inner) => {
    const expression = inner.trim();
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(expression)) {
      const value = constants.get(expression);
      if (value !== undefined && !value.includes("${")) return value;
    }
    unknown.push(expression.trim());
    return "\u0002";
  });
  return { filled: filled.replace(/\s+/g, " ").trim(), unknown };
}

/** Number of `?` placeholders, ignoring those inside string literals. Null if the statement
 * uses a binding style this checker does not reason about. */
function countPlaceholders(sql) {
  let count = 0;
  let inString = false;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    if (char === "'") {
      if (inString && sql[index + 1] === "'") index += 1;
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char !== "?") continue;
    if (sql[index + 1] === "?" || sql[index - 1] === "?") return null; // `??` operator in a fragment
    if (/\d/.test(sql[index + 1] ?? "")) return null; // `?NNN` indexed parameter
    count += 1;
  }
  return count;
}

/**
 * Reads the argument list a literal is bound to, right after the string: either
 * `, params: [ … ]` / `, [ … ]` (the DB helpers) or `.bind( … )` (prepared statements).
 * Returns null when the shape is not statically countable, so the caller skips it.
 */
function boundArgsAfter(source, start) {
  let index = start;
  while (index < source.length && /[\s)]/.test(source[index])) index += 1;
  let rest = source.slice(index, index + 40);
  let opener = "[";
  if (/^\s*,\s*params:\s*\[/.test(rest)) {
    index = source.indexOf("[", index);
  } else if (/^\s*,\s*\[/.test(rest)) {
    index = source.indexOf("[", index);
  } else if (/^\s*\)\s*\.bind\s*\(/.test(source.slice(index, index + 20))) {
    opener = "(";
    index = source.indexOf("(", source.indexOf(".bind", index));
    rest = "";
  } else {
    return null;
  }
  if (index < 0) return null;
  void rest;
  const close = opener === "[" ? "]" : ")";
  let depth = 0;
  let end = -1;
  for (let i = index; i < source.length; i += 1) {
    const char = source[i];
    if (char === "[" || char === "(" || char === "{") depth += 1;
    else if (char === "]" || char === ")" || char === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  // JS allows a trailing comma — multi-line arrays are written with one everywhere in this
  // codebase — so drop it before counting separators.
  const inner = source
    .slice(index + 1, end)
    .trim()
    .replace(/,\s*$/, "");
  if (inner.length === 0) return { count: 0, style: close === ")" ? "bind" : "array" };
  if (/\.\.\./.test(inner)) return null; // spread — cannot count statically
  let commas = 0;
  let nested = 0;
  let quote = null;
  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(" || char === "[" || char === "{") nested += 1;
    else if (char === ")" || char === "]" || char === "}") nested -= 1;
    else if (char === "," && nested === 0) commas += 1;
  }
  return { count: commas + 1, style: close === ")" ? "bind" : "array" };
}

const FILLS = [
  "1 = 1",
  "1",
  "'x'",
  "AND 1 = 1",
  "FROM businesses b",
  "LEFT JOIN locations l ON l.id = b.location_id",
  "name = 'x'",
  "id = 1",
  "services",
  "products",
  "id",
  "*",
  "GROUP BY 1",
];

function variants(filled, unknownCount) {
  if (unknownCount === 0) return [filled];
  if (unknownCount > 3) return []; // too many request-derived holes to reason about statically
  let options = [filled];
  for (let index = 0; index < unknownCount; index += 1) {
    const next = [];
    for (const option of options) {
      for (const fillValue of FILLS) next.push(option.replace("\u0002", fillValue));
    }
    options = next;
  }
  return options.filter((option) => option.includes("\u0002") === false);
}

let findings = 0;
let checked = 0;
let dynamic = 0;

for (const file of tsFiles(join(WORKER, "src"))) {
  const source = readFileSync(file, "utf8");
  const constants = constantMap(source);
  const lineOf = (index) => source.slice(0, index).split("\n").length;

  const literals = [];
  for (const match of source.matchAll(
    /`((?:[^`\\]|\\[\s\S])*)`|"((?:[^"\\]|\\[\s\S])*)"|'((?:[^'\\]|\\[\s\S])*)'/g,
  )) {
    const raw = match[1] ?? match[2] ?? match[3] ?? "";
    if (raw.length < 14) continue;
    const text = unquote(raw, match[1] !== undefined);
    if (/\b(select|insert|update|delete|from|where|values|set)\b/i.test(text) === false) continue;
    const { filled, unknown } = fill(text, constants);
    if (!looksLikeSql(filled)) continue;
    literals.push({
      sql: filled,
      holes: unknown.length,
      line: lineOf(match.index ?? 0),
      end: (match.index ?? 0) + match[0].length,
    });
  }

  for (const { sql, holes, line } of literals) {
    if (/\b(new|old)\./.test(sql)) continue; // trigger bodies, validated by the migration itself
    if (holes > 3) {
      dynamic += 1;
      if (VERBOSE)
        console.log(`  skip ${relative(ROOT, file)}:${line}  ${holes} request-derived fragments`);
      continue;
    }
    checked += 1;
    let firstError = null;
    let ok = false;
    for (const candidate of variants(sql, holes)) {
      try {
        db.prepare(candidate);
        ok = true;
        break;
      } catch (error) {
        firstError ??= error;
      }
    }
    if (!ok && firstError) {
      findings += 1;
      console.log(`\n${relative(ROOT, file)}:${line}  ${String(firstError.message ?? firstError)}`);
      console.log(`    ${sql.slice(0, 300)}`);
    }
  }

  // Parameter arity: every `?` in the statement must have exactly one bound value, and a
  // mismatch is invisible to the typechecker. This is not theoretical — `POST /report` shipped
  // with 11 placeholders and 10 params and answered 500 for the *business* target only,
  // because the extra UPDATE branch is what pushed the count out.
  for (const { sql, holes, line, end } of literals) {
    if (holes > 0) continue; // dynamic fragment: the param list is assembled at runtime
    const placeholders = countPlaceholders(sql);
    if (placeholders === null) continue; // `?NNN`/`:name` binding styles are not used here, ignore rather than guess
    const bound = boundArgsAfter(source, end);
    if (bound === null) continue;
    if (bound.count !== placeholders) {
      findings += 1;
      console.log(
        `\n${relative(ROOT, file)}:${line}  statement binds ${placeholders} parameter(s) but supplies ${bound.count}${bound.style === "bind" ? " via .bind()" : ""}`,
      );
      console.log(`    ${sql.slice(0, 300)}`);
    }
  }

  // Qualifier audit: `alias.column` must be introduced by a FROM/JOIN/UPDATE in the same
  // statement. This catches the class of bug prepare() can forgive (a nested SELECT whose
  // alias lives outside the extracted literal).
  for (const { sql, line } of literals) {
    if (!/\bfrom\s+[a-z_]/i.test(sql)) continue;
    const declared = new Set([
      "new",
      "old",
      "excluded",
      "json",
      "row",
      "sql",
      "params",
      "env",
      "c",
      "inserted",
    ]);
    let introduced = 0;
    for (const match of sql.matchAll(
      /\b(?:from|join|into|update)\s+([a-z_][a-z0-9_]*)(?:\s+(?!where\b|set\b|on\b|values\b|using\b|inner\b|left\b|right\b|cross\b|join\b|group\b|order\b|limit\b|as\b|select\b)([a-z_][a-z0-9_]*))?/gi,
    )) {
      const table = String(match[1]).toLowerCase();
      if (!TABLES.has(table)) continue;
      declared.add(table);
      if (match[2]) declared.add(String(match[2]).toLowerCase());
      introduced += 1;
    }
    if (introduced === 0) continue; // no known table in this fragment; nothing to compare against
    const offenders = new Set();
    for (const match of sql.matchAll(/\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/gi)) {
      const prefix = String(match[1]).toLowerCase();
      if (!declared.has(prefix)) offenders.add(`${prefix}.${match[2]}`);
    }
    if (offenders.size > 0) {
      findings += 1;
      console.log(
        `\n${relative(ROOT, file)}:${line}  alias never introduced by FROM/JOIN: ${[...offenders].join(", ")}`,
      );
      console.log(`    ${sql.slice(0, 300)}`);
    }
  }
}

try {
  db.exec(readFileSync(join(WORKER, "dev", "seed.sql"), "utf8"));
  const businesses = Number(db.prepare("SELECT COUNT(*) AS n FROM businesses").get()?.n ?? 0);
  const index = Number(db.prepare("SELECT COUNT(*) AS n FROM business_search_index").get()?.n ?? 0);
  console.log(
    `\nseed.sql applies cleanly: ${businesses} businesses, ${index} search rows maintained by triggers`,
  );
} catch (error) {
  findings += 1;
  console.log(`\nworker/dev/seed.sql — ${String(error.message ?? error)}`);
}

console.log(
  `\n${checked} statement(s) prepared against ${TABLES.size} tables, ${dynamic} dynamic statement(s) skipped, ${findings} finding(s).`,
);
process.exit(findings === 0 ? 0 : 1);
