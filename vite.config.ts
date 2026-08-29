// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Accept preview/sandbox hostnames (e.g. *.e2b.app) in dev.
    server: {
      allowedHosts: true,
      // Dev-only: run the preview against the local Cloudflare Worker
      // (`cd backend && npx wrangler dev --port 8787`). Without the Worker
      // running, /api/health fails and the app falls back to demo mode.
      proxy: {
        "/api": "http://127.0.0.1:8787",
        "/l": "http://127.0.0.1:8787",
      },
    },
  },
});
