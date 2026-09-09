# Directory search is LIKE over a trigger-maintained haystack, not FTS5

**Status:** accepted (2026-09-09) · revisit when listings pass ~50k or typo tolerance is requested

## Context

`GET /api/v1/search` must filter by category, city/state, verification, amenities, open-now and
rating, sort by relevance/rating/reviews/newest/response time, paginate, and return facet counts —
while D1 is the only database. D1 supports SQLite `LIKE` and (recently) full-text search virtual
tables, but not `tsvector`, trigram indexes or ranking functions.

The directory's own shape matters: at the size this product will have for a long time (hundreds to
low thousands of listings per city, a few hundred categories/locations), the whole corpus of
searchable text is small enough to hold in one `TEXT` column per business.

## Decision

`business_search_index(business_id, search_text)` holds a lowercase blob of name, tagline, about,
category name, city, area, amenities and catalogue item names, maintained by D1 triggers on
`businesses`, `catalog_items` and `categories`. The search handler:

1. tokenises the query, escapes `%`, `_` and `\` (`likeEscape` in `worker/src/db.ts`),
2. ANDs one `search_text LIKE ?` per token,
3. applies the structured filters (category/location/verified/amenity/minRating) in SQL,
4. sorts with the `SORT_SQL` map, where `relevance` is a coarse case in SQL
   (`rating_avg*4 + LEAST(rating_count,200)/10 + is_featured*6 + …`),
5. filters `openNow` in JS using `isOpenNow()` on that page's opening hours only,
6. computes facets with two `GROUP BY` queries over the same WHERE clause.

Responses are cached in KV for 30s with `s-maxage=120`, so the repeated queries of a browse
session are cheap.

## Consequences

* **Gained:** predictable behaviour with zero index maintenance; substring matching means
  "adire" finds "Adìrè Atelier" (accents are folded at index time by the trigger); relevance is a
  formula we control and can explain in the admin console; no FTS5 tokenizer surprises in D1.
* **Cost:** no typo tolerance, no stemming, no BM25. `LIKE '%term%'` cannot use an index, so the
  scan is O(corpus) — acceptable at this size, and the corpus is one row per business, not one
  row per word. Relevance is intentionally coarse; the first page of "pharmacy" in Ikeja is
  ordered by rating, verification and freshness, which is what a consumer of this product
  actually wants.
* **Known limits, documented rather than hidden:** a query shorter than 2 characters is answered
  with `ambiguousQuery` + suggestions instead of a full scan; results beyond page 50 of a
  1 000-listing corpus will get slower; a `q` with 6+ tokens is truncated to 6.

## Alternatives considered

* **FTS5 virtual table in D1** — genuinely attractive (`bm25`, `PREFIX` queries), rejected for now
  because D1's FTS5 support is still uneven across regions, an FTS index must be rebuilt if the
  tokenizer changes, and it does not help with the part that matters here: matching *accented*
  Nigerian trade names, for which a folded haystack + LIKE is strictly better than the default
  unicode61 tokenizer. The trigger surface is identical (a second table to maintain), so nothing
  in the current design blocks swapping it in — the `searchText` column is the contract.
* **Algolia/Typesense/Meilisearch sidecar** — rejected: an external index for a directory whose
  freshness requirement is "a published listing appears within a minute" is a second source of
  truth, an API key to rotate and a bill.
* **`normalize()` + FTS** — SQLite's `normalize()` is ICU-dependent in D1; folding accents at
  write time into the haystack is deterministic and testable.
