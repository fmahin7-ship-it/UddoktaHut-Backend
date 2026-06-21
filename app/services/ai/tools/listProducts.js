import { runStoreQuery } from "./sql/runStoreQuery.js";

const MAX_LIMIT = 50;

const listProducts = async ({ storeName, limit = 20, category = null }) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);

  const sql = category
    ? `
      SELECT p.name, p.price, p.stock, p.status, p.category, p.sku
      FROM products p
      JOIN stores s ON p.store_id = s.id
      WHERE s.store_name = :storeName
        AND LOWER(p.category) = LOWER(:category)
      ORDER BY p."createdAt" DESC
      LIMIT :limit
      `
    : `
      SELECT p.name, p.price, p.stock, p.status, p.category, p.sku
      FROM products p
      JOIN stores s ON p.store_id = s.id
      WHERE s.store_name = :storeName
      ORDER BY p."createdAt" DESC
      LIMIT :limit
      `;

  const replacements = category
    ? { limit: safeLimit, category: String(category).slice(0, 100) }
    : { limit: safeLimit };

  return runStoreQuery(sql, replacements, storeName, "tool-list-products");
};

export { listProducts };
