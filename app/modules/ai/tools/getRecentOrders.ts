import { ORDER_STATUSES } from "../../../constants/orderConstants.ts";
import { runStoreQuery } from "./sql/runStoreQuery.ts";

const MAX_LIMIT = 20;
const ALLOWED_STATUSES = new Set(Object.values(ORDER_STATUSES));

const getRecentOrders = async ({
  storeName,
  limit = 10,
  status = null,
}: {
  storeName: string;
  limit?: number;
  status?: string | null;
}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), MAX_LIMIT);
  const normalizedStatus =
    status && ALLOWED_STATUSES.has(String(status).toLowerCase())
      ? String(status).toLowerCase()
      : null;

  const statusClause = normalizedStatus
    ? "AND o.status = :status"
    : "";

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
      ${statusClause}
    ORDER BY o.created_at DESC
    LIMIT :limit
    `,
    normalizedStatus
      ? { limit: safeLimit, status: normalizedStatus }
      : { limit: safeLimit },
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
