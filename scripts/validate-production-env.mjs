const required = [
  "CLOUDFLARE_API_URL",
  "CLOUDFLARE_PROXY_SECRET",
  "VITE_SITE_URL",
  "VITE_LEGAL_OPERATOR_NAME",
  "VITE_PRIVACY_EMAIL",
  "VITE_SUPPORT_EMAIL",
  "VITE_GOVERNING_LAW",
  "VITE_DISPUTE_FORUM",
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing required production environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

for (const name of ["CLOUDFLARE_API_URL", "VITE_SITE_URL"]) {
  const value = process.env[name];
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    console.error(`${name} must be an absolute URL.`);
    process.exit(1);
  }
  const hostname = parsed.hostname.toLowerCase();
  const placeholderHost =
    hostname === "localhost" ||
    !hostname.includes(".") ||
    [".example", ".invalid", ".localhost", ".test"].some((suffix) => hostname.endsWith(suffix));
  if (parsed.protocol !== "https:" || placeholderHost || parsed.username || parsed.password) {
    console.error(`${name} must use a real credential-free HTTPS origin, not a placeholder host.`);
    process.exit(1);
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    console.error(`${name} must be an origin without a path, query string or fragment.`);
    process.exit(1);
  }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
for (const name of ["VITE_PRIVACY_EMAIL", "VITE_SUPPORT_EMAIL"]) {
  const email = process.env[name].trim();
  const domain = email.split("@").at(-1)?.toLowerCase() ?? "";
  const placeholderDomain = [".example", ".invalid", ".localhost", ".test"].some((suffix) =>
    domain.endsWith(suffix),
  );
  if (!emailPattern.test(email) || placeholderDomain) {
    console.error(`${name} must be a valid monitored address on a real domain.`);
    process.exit(1);
  }
}

if (process.env.VITE_LEGAL_OPERATOR_NAME.trim().length < 2) {
  console.error("VITE_LEGAL_OPERATOR_NAME must identify the actual legal operator.");
  process.exit(1);
}

const proxySecret = process.env.CLOUDFLARE_PROXY_SECRET.trim();
if (proxySecret.length < 32 || /(?:replace|placeholder|example|secret)/i.test(proxySecret)) {
  console.error("CLOUDFLARE_PROXY_SECRET must be a random value of at least 32 characters.");
  process.exit(1);
}

for (const name of ["VITE_GOVERNING_LAW", "VITE_DISPUTE_FORUM"]) {
  const value = process.env[name].trim();
  if (value.length < 5 || /(?:placeholder|example|todo|your reviewed)/i.test(value)) {
    console.error(`${name} must contain the operator's reviewed production wording.`);
    process.exit(1);
  }
}

console.log("Production public configuration is present and structurally valid.");
