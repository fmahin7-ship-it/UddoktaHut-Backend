import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => parseInt(val ?? "1", 10) || 1),
  pageSize: z
    .string()
    .optional()
    .transform((val) => parseInt(val ?? "10", 10) || 10),
  search: z.string().optional().default(""),
  sortBy: z.string().optional().default("id"),
  sortOrder: z.string().optional().default("desc"),
});
