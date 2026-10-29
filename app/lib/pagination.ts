import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  or,
  type SQL,
} from "drizzle-orm";
import { db } from "../db/client.ts";
import { products, stores } from "../db/schema/index.ts";

type ProductSortKey = "id" | "name" | "category" | "sku" | "price" | "stock";

const productSortColumn = (sortBy: string) => {
  const key = sortBy as ProductSortKey;
  if (key in products) {
    return products[key as keyof typeof products] as typeof products.id;
  }
  return products.id;
};

export const paginateUserProducts = async ({
  page = 1,
  pageSize = 10,
  search = "",
  sortBy = "id",
  sortOrder = "desc",
  userId,
}: {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  userId: number;
}) => {
  const filters: SQL[] = [eq(products.user_id, userId)];

  if (search) {
    filters.push(
      or(
        ilike(products.name, `%${search}%`),
        ilike(products.category, `%${search}%`),
        ilike(products.sku, `%${search}%`)
      )!
    );
  }

  const where = and(...filters);
  const order =
    sortOrder?.toLowerCase() === "asc"
      ? asc(productSortColumn(sortBy))
      : desc(productSortColumn(sortBy));
  const offset = (page - 1) * pageSize;

  const [totalRow] = await db
    .select({ count: count() })
    .from(products)
    .where(where);

  const rows = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset(offset);

  return {
    data: rows,
    total: totalRow?.count ?? 0,
    page,
    pageSize,
  };
};

export const paginateActiveStoreProducts = async ({
  storeName,
  page = 1,
  pageSize = 10,
  search = "",
  sortBy = "id",
  sortOrder = "desc",
  status,
}: {
  storeName: string;
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  status: string;
}) => {
  const filters: SQL[] = [
    eq(stores.store_name, storeName),
    eq(products.status, status),
  ];

  if (search) {
    filters.push(
      or(
        ilike(products.name, `%${search}%`),
        ilike(products.category, `%${search}%`),
        ilike(products.sku, `%${search}%`)
      )!
    );
  }

  const where = and(...filters);
  const order =
    sortOrder?.toLowerCase() === "asc"
      ? asc(productSortColumn(sortBy))
      : desc(productSortColumn(sortBy));
  const offset = (page - 1) * pageSize;

  const counted = await db
    .select({ count: count() })
    .from(products)
    .innerJoin(stores, eq(products.store_id, stores.id))
    .where(where);

  const rows = await db
    .select({ product: products })
    .from(products)
    .innerJoin(stores, eq(products.store_id, stores.id))
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset(offset);

  return {
    data: rows.map((r) => r.product),
    total: counted[0]?.count ?? 0,
    page,
    pageSize,
  };
};
