import { z } from "zod";

export const productCreateSchema = z.object({
  name: z.string().min(1),
  image: z.string().url().optional(),
  price: z.number().positive(),
  stock: z.number().int().nonnegative(),
  status: z.enum(["active", "inactive"]),
  category: z.string().min(1),
  sku: z.string().min(1),
  storeName: z.string().min(1),
});

export const productUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  image: z.string().url().optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().nonnegative().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  category: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
});

export const productIdParamSchema = z.object({
  id: z.string().regex(/^[0-9]+$/, "Product ID must be a number"),
});
