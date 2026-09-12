import "@tanstack/react-start/server-only";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]);

function workerOrigin(): URL | null {
  const configured = process.env["CLOUDFLARE_API_URL"]?.trim();
  if (configured) {
    try {
      return new URL(configured);
    } catch {
      return null;
    }
  }
  return process.env["NODE_ENV"] === "production" ? null : new URL("http://127.0.0.1:8787");
}

function configuredProxySecret(): string | null {
  const secret = process.env["CLOUDFLARE_PROXY_SECRET"]?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

function configurationError(message: string): Response {
  return Response.json(
    {
      error: { code: "API_NOT_CONFIGURED", message },
      requestId: crypto.randomUUID(),
    },
    {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-gainhub-proxy": "vercel-edge",
      },
    },
  );
}

export async function proxyToWorker(
  request: Request,
  splat: string | undefined,
): Promise<Response> {
  const origin = workerOrigin();
  if (!origin) return configurationError("The application service is not configured.");
  const proxySecret = configuredProxySecret();
  if (process.env["NODE_ENV"] === "production" && !proxySecret) {
    return configurationError("The secure application proxy is not configured.");
  }

  const incomingUrl = new URL(request.url);
  const safePath = (splat ?? "").replace(/^\/+/, "");
  const destination = new URL(`/${safePath}${incomingUrl.search}`, origin);
  const headers = new Headers(request.headers);
  const forwardedClientIp = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  for (const header of HOP_BY_HOP_HEADERS) headers.delete(header);
  for (const header of [
    "cf-connecting-ip",
    "true-client-ip",
    "x-real-ip",
    "x-forwarded-for",
    "x-gainhub-client-ip",
    "x-gainhub-proxy-secret",
  ]) {
    headers.delete(header);
  }
  if (proxySecret) headers.set("x-gainhub-proxy-secret", proxySecret);
  if (proxySecret && forwardedClientIp && /^[0-9a-f:.]{3,64}$/i.test(forwardedClientIp)) {
    headers.set("x-gainhub-client-ip", forwardedClientIp);
  }
  headers.set("x-forwarded-host", incomingUrl.host);
  headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

  let response: Response;
  try {
    response = await fetch(destination, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
      duplex: "half",
    } as RequestInit);
  } catch {
    return Response.json(
      {
        error: {
          code: "API_UNAVAILABLE",
          message: "The application service is temporarily unavailable. Please try again.",
        },
        requestId: crypto.randomUUID(),
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "retry-after": "5",
          "x-content-type-options": "nosniff",
          "x-gainhub-proxy": "vercel-edge",
        },
      },
    );
  }

  const responseHeaders = new Headers(response.headers);
  for (const header of HOP_BY_HOP_HEADERS) responseHeaders.delete(header);
  // Node fetch transparently decodes upstream compression while retaining
  // the upstream wire headers. Forwarding either header corrupts the body.
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.set("x-gainhub-proxy", "vercel-edge");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
