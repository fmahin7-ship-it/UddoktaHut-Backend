import { ORDER_STATUSES } from "../../../constants/orderConstants.js";
import { runStoreQuery } from "./sql/runStoreQuery.js";

const PERIOD_FILTERS = {
  today: "o.created_at >= CURRENT_DATE",
  "7d": "o.created_at >= NOW() - INTERVAL '7 days'",
  "30d": "o.created_at >= NOW() - INTERVAL '30 days'",
  all: "TRUE",
};

const normalizePeriod = (period) => {
  const key = String(period || "30d").toLowerCase();
  return PERIOD_FILTERS[key] ? key : "30d";
};

const getOrderSummary = async ({ storeName, period = "30d" }) => {
  const periodKey = normalizePeriod(period);
  const dateFilter = PERIOD_FILTERS[periodKey];

  const rows = await runStoreQuery(
    `
    SELECT
      COUNT(*)::int AS order_count,
      COUNT(*) FILTER (WHERE o.status = :pendingStatus)::int AS pending_orders,
      COUNT(*) FILTER (WHERE o.status = :confirmedStatus)::int AS confirmed_orders,
      COUNT(*) FILTER (WHERE o.status = :deliveredStatus)::int AS delivered_orders,
      COUNT(*) FILTER (WHERE o.status = :cancelledStatus)::int AS cancelled_orders,
      ROUND(
        COALESCE(
          SUM(o.total) FILTER (WHERE o.status <> :cancelledStatus),
          0
        )::numeric,
        2
      ) AS total_revenue,
      ROUND(
        COALESCE(
          AVG(o.total) FILTER (WHERE o.status <> :cancelledStatus),
          0
        )::numeric,
        2
      ) AS avg_order_value
    FROM orders o
    JOIN stores s ON o.store_id = s.id
    WHERE s.store_name = :storeName
      AND ${dateFilter}
    `,
    {
      pendingStatus: ORDER_STATUSES.PENDING,
      confirmedStatus: ORDER_STATUSES.CONFIRMED,
      deliveredStatus: ORDER_STATUSES.DELIVERED,
      cancelledStatus: ORDER_STATUSES.CANCELLED,
    },
    storeName,
    "tool-get-order-summary"
  );

  return {
    period: periodKey,
    ...(rows[0] ?? {}),
  };
};

export { getOrderSummary };
