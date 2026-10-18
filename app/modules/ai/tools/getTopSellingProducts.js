import { ORDER_STATUSES } from "../../../constants/orderConstants.js";
import { runStoreQuery } from "./sql/runStoreQuery.js";

const MAX_LIMIT = 20;
const MAX_DAYS = 365;

const getTopSellingProducts = async ({ storeName, limit = 10, days = 30 }) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), MAX_LIMIT);
  const safeDays = Math.min(Math.max(Number(days) || 30, 1), MAX_DAYS);

  const rows = await runStoreQuery(
    `
    SELECT
      oi.product_name,
      SUM(oi.quantity)::int AS units_sold,
      ROUND(SUM(oi.line_total)::numeric, 2) AS revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN stores s ON o.store_id = s.id
    WHERE s.store_name = :storeName
      AND o.status <> :cancelledStatus
      AND o.created_at >= NOW() - (:days || ' days')::interval
    GROUP BY oi.product_id, oi.product_name
    ORDER BY units_sold DESC, revenue DESC
    LIMIT :limit
    `,
    {
      cancelledStatus: ORDER_STATUSES.CANCELLED,
      days: safeDays,
      limit: safeLimit,
    },
    storeName,
    "tool-get-top-selling-products"
  );

  return {
    days: safeDays,
    count: rows.length,
    products: rows,
  };
};

export { getTopSellingProducts };
