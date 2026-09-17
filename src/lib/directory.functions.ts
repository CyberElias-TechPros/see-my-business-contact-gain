import { createServerFn } from "@tanstack/react-start";
import { directoryQuerySchema, slugSchema } from "./contracts";
import {
  queryBusiness,
  queryBusinessReviews,
  queryDirectory,
  queryRelatedBusinesses,
  querySuggestions,
  queryTaxonomy,
} from "./directory.server";

const EMPTY_PAGE = (page: number, pageSize: number) => ({
  items: [],
  pagination: { page, pageSize, total: 0, pages: 1 },
});

/**
 * Every server function returns an explicit `available` flag rather than throwing.
 * A directory outage must degrade to a clearly labelled state on the page — never
 * to placeholder records that look like real businesses.
 */
export const getDirectoryResults = createServerFn({ method: "GET" })
  .validator((input: unknown) => directoryQuerySchema.parse(input))
  .handler(async ({ data }) => {
    try {
      return { available: true as const, result: await queryDirectory(data) };
    } catch {
      return { available: false as const, result: EMPTY_PAGE(data.page, data.pageSize) };
    }
  });

export const getDirectoryBusiness = createServerFn({ method: "GET" })
  .validator((input: unknown) => slugSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      return { available: true as const, business: await queryBusiness(data) };
    } catch {
      return { available: false as const, business: null };
    }
  });

export const getDirectoryTaxonomy = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { available: true as const, taxonomy: await queryTaxonomy() };
  } catch {
    return {
      available: false as const,
      taxonomy: { categories: [], locations: [] },
    };
  }
});

export const getBusinessReviews = createServerFn({ method: "GET" })
  .validator((input: unknown) => slugSchema.parse(input))
  .handler(async ({ data }) => {
    const reviews = await queryBusinessReviews(data);
    return {
      available: reviews !== null,
      reviews: reviews ?? {
        items: [],
        summary: { average: 0, total: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
        mine: null,
      },
    };
  });

export const getRelatedBusinesses = createServerFn({ method: "GET" })
  .validator((input: unknown) => slugSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      return { items: await queryRelatedBusinesses(data) };
    } catch {
      return { items: [] };
    }
  });

export const getSuggestions = createServerFn({ method: "GET" })
  .validator((input: unknown) => String(input ?? "").slice(0, 60))
  .handler(async ({ data }) => {
    try {
      return { items: await querySuggestions(data) };
    } catch {
      return { items: [] };
    }
  });
