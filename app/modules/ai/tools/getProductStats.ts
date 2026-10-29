import { PRODUCT_STATUS } from "../../../constants/productConstants.ts";
import { runStoreQuery } from "./sql/runStoreQuery.ts";

const getProductStats = async ({ storeName }: { storeName: string }) => {
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

  return (rows ?? [])[0] ?? {};
};

export { getProductStats };
