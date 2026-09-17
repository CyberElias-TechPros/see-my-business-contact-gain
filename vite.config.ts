// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only; target configured below), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // The web application (including the same-origin API proxy) deploys to Vercel.
  // The directory API remains the standalone Cloudflare Worker in worker/index.ts.
  nitro: { preset: "vercel" },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      // Dev-only: allow the ephemeral sandbox preview hostnames (and Vercel preview
      // domains) to reach the Vite dev server. `allowedHosts` is a development-server
      // option only — it is never compiled into the production build.
      allowedHosts: [".e2b.app", ".vercel.app", ".lovable.app", ".lovableproject.com"],
      cors: true,
    },
  },
});
