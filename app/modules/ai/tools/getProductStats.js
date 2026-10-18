import { PRODUCT_STATUS } from "../../../constants/productConstants.js";
import { runStoreQuery } from "./sql/runStoreQuery.js";

const getProductStats = async ({ storeName }) => {
  const rows = await runStoreQuery(
    `
    SELECT
      COUNT(*)::int AS total_products,
      COUNT(*) FILTER (WHERE p.status = :activeStatus)::int AS active_products,
      COUNT(*) FILTER (WHERE p.stock <= 0)::int AS out_of_stock,
      ROUND(AVG(p.price)::numeric, 2) AS avg_price,
      COALESCE(SUM(p.stock), 0)::int AS total_stock_units
    FROM products p
    JOIN stores s ON p.store_id = s.id
    WHERE s.store_name = :storeName
    `,
    { activeStatus: PRODUCT_STATUS.ACTIVE },
    storeName,
    "tool-get-product-stats"
  );

  return rows[0] ?? {};
};

export { getProductStats };
