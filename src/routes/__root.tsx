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
import { CustomCursor, ScrollProgress } from "@/components/motion";
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
        className="grain relative grid min-h-screen place-items-center overflow-hidden bg-ink px-5 py-20 text-ink-foreground"
      >
        <div aria-hidden="true" className="aurora opacity-60" />
        <div
          aria-hidden="true"
          className="absolute -left-32 top-10 size-[28rem] rounded-full border border-white/8"
        />
        <div
          aria-hidden="true"
          className="absolute -right-24 bottom-0 size-[22rem] rounded-full border border-sidebar-primary/14"
        />

        <div
          className="relative max-w-2xl text-center"
          style={{ animation: "reveal-up 800ms var(--ease-out-expo) both" }}
        >
          <p className="eyebrow text-sidebar-primary">404 · Lost signal</p>

          {/* The number carries the moment: oversized, outlined, and part of the
              composition rather than a stock error glyph. */}
          <p
            aria-hidden="true"
            className="mt-6 select-none font-display text-[8rem] font-extrabold leading-[0.78] tracking-[-0.06em] text-transparent sm:text-[11rem]"
            style={{ WebkitTextStroke: "1.5px oklch(1 0 0 / 0.22)" }}
          >
            404
          </p>
          <h1 className="display-md -mt-4 text-ink-foreground sm:-mt-8">Not on the map.</h1>

          <p className="mx-auto mt-5 max-w-md leading-7 text-ink-foreground/65">
            This page may have moved, been removed, or never existed. Let&apos;s get you back to a
            useful route.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/">
                <ArrowLeft /> Go home
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-transparent text-ink-foreground hover:bg-white/10"
            >
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
        className="grain paper-grid relative grid min-h-screen place-items-center overflow-hidden bg-background px-5 py-20"
      >
        <div aria-hidden="true" className="aurora opacity-25" />
        <div className="relative max-w-lg text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </span>
          <h1 className="display-md mt-6">The signal dropped.</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted-foreground">
            This page did not load correctly. Try once more; if the problem continues, return home
            and use another route.
          </p>
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
        {/* Motion primitives rely on CSS for their hidden state. Without scripting
            the end state is applied immediately so nothing is ever invisible. */}
        <noscript>
          <style>{`.motion-reveal{opacity:1!important;filter:none!important;transform:none!important;clip-path:none!important}.text-reveal__inner{transform:none!important}`}</style>
        </noscript>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <QueryClientProvider client={queryClient}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <ScrollProgress />
      <CustomCursor />
      {/* Keyed on the pathname so navigation replays the entrance animation and
          the experience feels continuous rather than abrupt. */}
      <div key={pathname} className="route-transition">
        <Outlet />
      </div>
    </QueryClientProvider>
  );
}
