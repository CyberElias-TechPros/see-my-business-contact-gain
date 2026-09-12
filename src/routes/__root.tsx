import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useLocation,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Button } from "@/components/ui/button";
import { publicConfig } from "@/lib/public-config";

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error("An unknown application error occurred");
}

function NotFoundComponent() {
  return (
    <>
      <title>Page not found — GainHub NG</title>
      <meta name="robots" content="noindex, nofollow" />
      <main
        id="main-content"
        className="paper-grid grid min-h-screen place-items-center bg-background px-4 py-16"
      >
        <div className="max-w-xl text-center">
          <p className="eyebrow text-primary">404 · Lost signal</p>
          <h1 className="mt-4 text-6xl font-bold leading-none text-foreground sm:text-8xl">
            Not on the map.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-muted-foreground">
            This page may have moved, been removed, or never existed. Let&apos;s get you back to a
            useful route.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/">
                <ArrowLeft /> Go home
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/search">Search the directory</Link>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const applicationError = asError(error);
  const router = useRouter();

  useEffect(() => {
    reportLovableError(applicationError, { boundary: "tanstack_root_error_component" });
  }, [applicationError]);

  return (
    <>
      <title>Page unavailable — GainHub NG</title>
      <meta name="robots" content="noindex, nofollow" />
      <main
        id="main-content"
        className="paper-grid grid min-h-screen place-items-center bg-background px-4 py-16"
      >
        <div className="card-surface max-w-lg p-8 text-center sm:p-10">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground">
            The signal dropped.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This page did not load correctly. Try once more; if the problem continues, return home
            and use another route.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button
              onClick={() => {
                void router.invalidate();
                reset();
              }}
            >
              <RefreshCw /> Try again
            </Button>
            <Button asChild variant="outline">
              <a href="/">Go home</a>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "GainHub NG",
  description: "A conversation-first discovery and lead-routing platform for Nigerian businesses.",
  ...(publicConfig.siteUrl
    ? {
        url: publicConfig.siteUrl,
        potentialAction: {
          "@type": "SearchAction",
          target: `${publicConfig.siteUrl.replace(/\/$/, "")}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      }
    : {}),
};

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      {
        name: "description",
        content:
          "Discover Nigerian businesses by service and city, compare useful details, and contact the right provider on WhatsApp.",
      },
      { name: "theme-color", content: "#12372a" },
      { name: "color-scheme", content: "light dark" },
      { name: "format-detection", content: "telephone=no" },
      { property: "og:site_name", content: "GainHub NG" },
      { property: "og:locale", content: "en_NG" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "GainHub NG — Find local businesses" },
      {
        property: "og:description",
        content:
          "Search by need and location, compare trust signals, then start a WhatsApp conversation.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      ...(publicConfig.siteUrl
        ? [
            {
              property: "og:image",
              content: `${publicConfig.siteUrl.replace(/\/$/, "")}/og-card.png`,
            },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
            {
              property: "og:image:alt",
              content: "GainHub NG — find the right local business and start talking",
            },
            {
              name: "twitter:image",
              content: `${publicConfig.siteUrl.replace(/\/$/, "")}/og-card.png`,
            },
          ]
        : []),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "alternate icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function canonicalUrl(pathname: string): string | undefined {
  if (!publicConfig.siteUrl) return undefined;
  try {
    return new URL(pathname, publicConfig.siteUrl).toString();
  } catch {
    return undefined;
  }
}

function RootShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const canonical = canonicalUrl(location.pathname);

  return (
    <html lang="en-NG">
      <head>
        <HeadContent />
        {canonical ? <link rel="canonical" href={canonical} /> : null}
        {canonical ? <meta property="og:url" content={canonical} /> : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema).replace(/</g, "\\u003c"),
          }}
        />
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
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Outlet />
    </QueryClientProvider>
  );
}
