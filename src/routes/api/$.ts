import { createFileRoute } from "@tanstack/react-router";
import { proxyToWorker } from "@/lib/worker-proxy.server";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      ANY: async ({ request, params }) => proxyToWorker(request, params._splat),
    },
  },
});
