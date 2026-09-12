import { createServerFn } from "@tanstack/react-start";
import { directoryQuerySchema, slugSchema } from "./contracts";
import { queryBusiness, queryDirectory } from "./directory.server";

export const getDirectoryResults = createServerFn({ method: "GET" })
  .validator((input: unknown) => directoryQuerySchema.parse(input))
  .handler(async ({ data }) => {
    try {
      return { available: true as const, result: await queryDirectory(data) };
    } catch {
      return {
        available: false as const,
        result: {
          items: [],
          pagination: { page: data.page, pageSize: data.pageSize, total: 0, pages: 1 },
        },
      };
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
