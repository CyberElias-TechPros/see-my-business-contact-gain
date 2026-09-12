import { execFileSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const isProductionDeployment = process.env.VERCEL_ENV === "production";
if (isProductionDeployment) {
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL("./validate-production-env.mjs", import.meta.url))],
    {
      stdio: "inherit",
    },
  );
} else {
  console.log(
    `Building Vercel ${process.env.VERCEL_ENV ?? "local/unknown"} output without production legal/deployment validation.`,
  );
}

execFileSync(
  process.execPath,
  [fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)), "build"],
  { stdio: "inherit" },
);
