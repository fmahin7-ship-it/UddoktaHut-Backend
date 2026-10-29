import { eq, count } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { products } from "../../db/schema/index.ts";
import { SUBSCRIPTION_ERROR_CODES } from "../../constants/plans.ts";
import { throwAppError } from "../../lib/appError.ts";

const countStoreProducts = async (storeId: number) => {
  const [row] = await db
    .select({ count: count() })
    .from(products)
    .where(eq(products.store_id, storeId));
  return row?.count ?? 0;
};

const assertCanCreateProduct = async (storeId: number, maxProducts: number) => {
  const used = await countStoreProducts(storeId);

  if (used >= maxProducts) {
    throwAppError(
      `Product limit reached (${used}/${maxProducts}). Upgrade your plan to add more products.`,
      403,
      SUBSCRIPTION_ERROR_CODES.PRODUCT_LIMIT_REACHED,
      { used, limit: maxProducts }
    );
  }

  return { used, limit: maxProducts, remaining: maxProducts - used };
};

const getProductUsage = async (storeId: number, maxProducts: number) => {
  const used = await countStoreProducts(storeId);
  return {
    used,
    limit: maxProducts,
    remaining: Math.max(maxProducts - used, 0),
  };
};

export { assertCanCreateProduct, countStoreProducts, getProductUsage };
