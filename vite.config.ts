// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
//   You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * Origin of the Cloudflare Worker (`npm run worker:dev`). In production the same mapping is
 * done by `vercel.json`'s rewrites; here it is Vite's dev proxy, so the browser only ever talks
 * to one origin and the `SameSite=Lax` session cookie the API sets stays valid. Without this,
 * `fetch("/api/v1/…")` would hit the Vite server, get index.html back for an unmatched path, and
 * the app would look logged-out forever.
 */
const apiOrigin = process.env.VITE_API_ORIGIN ?? "http://localhost:8787";

const apiProxy = {
  target: apiOrigin,
  changeOrigin: true,
  // The Worker reads the visitor IP for abuse limits; keep whatever the client sent so a local
  // run can distinguish two identities (miniflare has no real `cf.clientIp`).
  xfwd: false,
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      proxy: {
        "/api/v1": apiProxy,
        "/media": apiProxy,
        "/go": apiProxy,
      },
    },
  },
});
