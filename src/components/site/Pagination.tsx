import { Button } from "@/components/ui/button";

/**
 * Pagination is server-driven everywhere it appears: the API answers `meta.page/totalPages`
 * computed from the same `COUNT(*)` as the result set, so a page can never promise a link that
 * leads nowhere. Anchors (not buttons) when a `basePath` is given, so the next page is crawlable
 * and survives a dead script tag.
 */
export function Pagination({
  page,
  totalPages,
  basePath,
  onPage,
}: {
  page: number;
  totalPages: number;
  /** e.g. `/search?category=beauty-spa` — a query string or extra path may follow. */
  basePath?: string;
  onPage?: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const window: number[] = [];
  const start = Math.max(1, page - 2);
  for (let candidate = start; candidate <= Math.min(totalPages, page + 2); candidate += 1)
    window.push(candidate);

  const href = (target: number) => {
    if (!basePath) return undefined;
    const url = new URL(basePath, "http://local.invalid");
    if (target <= 1) url.searchParams.delete("page");
    else url.searchParams.set("page", String(target));
    const search = url.searchParams.toString();
    return `${url.pathname}${search ? `?${search}` : ""}`;
  };

  const pageLink = (target: number, label: string, disabled: boolean) => {
    const current = target === page;
    // An <a> when the caller knows the canonical path (crawlable, works with JS off), an
    // onClick-driven button for in-app filtering where a full reload would be silly.
    if (basePath && !disabled) {
      return (
        <Button
          key={target}
          size="sm"
          variant={current ? "default" : "outline"}
          className="h-8 min-w-9 px-2 text-sm"
          asChild
        >
          <a href={href(target)} aria-current={current ? "page" : undefined}>
            {label}
          </a>
        </Button>
      );
    }
    return (
      <Button
        key={target}
        size="sm"
        variant={current ? "default" : "outline"}
        className="h-8 min-w-9 px-2 text-sm"
        disabled={disabled}
        aria-current={current ? "page" : undefined}
        onClick={() => onPage?.(target)}
      >
        {label}
      </Button>
    );
  };

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 pt-2"
      aria-label="Result pages"
    >
      <p className="text-xs text-muted-foreground">
        Page {page.toLocaleString("en-NG")} of {totalPages.toLocaleString("en-NG")}
      </p>
      <div className="flex items-center gap-1">
        {pageLink(Math.max(1, page - 1), "Previous", page <= 1)}
        {window[0]! > 1 ? (
          <span className="px-1 text-muted-foreground" aria-hidden="true">
            …
          </span>
        ) : null}
        {window.map((candidate) => pageLink(candidate, String(candidate), false))}
        {window[window.length - 1]! < totalPages ? (
          <span className="px-1 text-muted-foreground" aria-hidden="true">
            …
          </span>
        ) : null}
        {pageLink(Math.min(totalPages, page + 1), "Next", page >= totalPages)}
      </div>
    </nav>
  );
}
