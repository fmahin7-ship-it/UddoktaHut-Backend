import { runStoreQuery } from "./sql/runStoreQuery.js";

const getCategoriesBreakdown = async ({ storeName }) => {
  return runStoreQuery(
    `
    SELECT
      COALESCE(NULLIF(TRIM(p.category), ''), 'Uncategorized') AS category,
      COUNT(*)::int AS product_count,
      ROUND(AVG(p.price)::numeric, 2) AS avg_price
    FROM products p
    JOIN stores s ON p.store_id = s.id
    WHERE s.store_name = :storeName
    GROUP BY 1
    ORDER BY product_count DESC
    LIMIT 20
    `,
    {},
    storeName,
    "tool-get-categories"
  );
};

export { getCategoriesBreakdown };
