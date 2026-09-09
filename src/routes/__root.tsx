import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useMemo, type ReactNode } from "react";

import { SessionPrimer } from "../components/site/SessionPrimer.tsx";
import { sessionQuery } from "../lib/queries.ts";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  // Anything can be thrown — a string from a bad `throw`, a fetch rejection with no
  // message — and an error boundary that assumes `error instanceof Error` becomes the
  // second crash the user sees.
  const normalised = useMemo(
    () => (error instanceof Error ? error : new Error(String(error))),
    [error],
  );
  console.error(normalised);
  useEffect(() => {
    reportLovableError(normalised, { boundary: "tanstack_root_error_component" });
  }, [normalised]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        {import.meta.env.DEV && (
          <p className="mt-2 rounded-md bg-muted p-2 font-mono text-xs text-muted-foreground break-words">
            {normalised.message}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Defaults only: every public route overrides title/description/canonical. A 404 or an
      // error page therefore still identifies the product instead of shipping a template name.
      { title: "GainHub NG — WhatsApp-first business directory for Nigeria" },
      {
        name: "description",
        content:
          "Find verified Nigerian businesses with real photos, prices, opening hours and reviews, then message them on WhatsApp or send an enquiry.",
      },
      { name: "author", content: "GainHub NG" },
      { property: "og:site_name", content: "GainHub NG" },
      { property: "og:title", content: "GainHub NG — WhatsApp-first business directory" },
      {
        property: "og:description",
        content:
          "Get found, get saved, get customers — Nigeria's WhatsApp-first business directory.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@gainhubng" },
      // A person who lands on an error page should not hand Google a "successful" 200 body; the
      // status code is set by the handler, this only keeps the page out of the index meanwhile.
      { name: "robots", content: "index,follow" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  // One session read per document, on the server, before the first paint: the header can render
  // the account menu instead of "Sign in" flickering in a frame later, `/app` can redirect an
  // anonymous visitor before mounting a form they cannot submit, and the hydrated client reuses
  // the payload from the cache instead of refetching. `sessionProbe` swallows its own errors — an
  // API that is briefly unreachable must not turn `/` into an error page.
  loader: ({ context }) => context.queryClient.ensureQueryData(sessionQuery()),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <SessionPrimer />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
