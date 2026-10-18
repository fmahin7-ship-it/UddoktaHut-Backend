import { ORDER_STATUSES } from "../../../constants/orderConstants.js";
import { runStoreQuery } from "./sql/runStoreQuery.js";

const MAX_LIMIT = 20;
const ALLOWED_STATUSES = new Set(Object.values(ORDER_STATUSES));

const getRecentOrders = async ({ storeName, limit = 10, status = null }) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), MAX_LIMIT);
  const normalizedStatus =
    status && ALLOWED_STATUSES.has(String(status).toLowerCase())
      ? String(status).toLowerCase()
      : null;

  const rows = await runStoreQuery(
    `
    SELECT
      o.order_number,
      o.customer_name,
      o.customer_phone,
      o.status,
      o.payment_status,
      o.total,
      o.created_at
    FROM orders o
    JOIN stores s ON o.store_id = s.id
    WHERE s.store_name = :storeName
      AND (:status IS NULL OR o.status = :status)
    ORDER BY o.created_at DESC
    LIMIT :limit
    `,
    { limit: safeLimit, status: normalizedStatus },
    storeName,
    "tool-get-recent-orders"
  );

  return {
    status_filter: normalizedStatus,
    count: rows.length,
    orders: rows,
  };
};

export { getRecentOrders };
