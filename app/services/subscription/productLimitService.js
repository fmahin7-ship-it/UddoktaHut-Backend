import { Product } from "../../models/RootModel.js";
import { SUBSCRIPTION_ERROR_CODES } from "../../constants/plans.js";
import { throwAppError } from "../../lib/appError.js";

const countStoreProducts = async (storeId) =>
  Product.count({ where: { store_id: storeId } });

const assertCanCreateProduct = async (storeId, maxProducts) => {
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

const getProductUsage = async (storeId, maxProducts) => {
  const used = await countStoreProducts(storeId);
  return {
    used,
    limit: maxProducts,
    remaining: Math.max(maxProducts - used, 0),
  };
};

export { assertCanCreateProduct, countStoreProducts, getProductUsage };
