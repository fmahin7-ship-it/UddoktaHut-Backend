import { runStoreQuery } from "./sql/runStoreQuery.js";

const MAX_LIMIT = 50;

const getLowStockProducts = async ({ storeName, threshold = 5, limit = 20 }) => {
  const safeThreshold = Math.max(Number(threshold) || 5, 0);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);

  return runStoreQuery(
    `
    SELECT p.name, p.stock, p.price, p.sku, p.category
    FROM products p
    JOIN stores s ON p.store_id = s.id
    WHERE s.store_name = :storeName
      AND p.stock < :threshold
    ORDER BY p.stock ASC, p.name ASC
    LIMIT :limit
    `,
    { threshold: safeThreshold, limit: safeLimit },
    storeName,
    "tool-get-low-stock"
  );
};

export { getLowStockProducts };
