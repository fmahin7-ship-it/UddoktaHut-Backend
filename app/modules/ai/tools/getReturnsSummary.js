import { RETURN_STATUSES } from "../../../constants/orderConstants.js";
import { runStoreQuery } from "./sql/runStoreQuery.js";

const MAX_LIMIT = 20;

const getReturnsSummary = async ({ storeName, limit = 10, days = 30 }) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), MAX_LIMIT);
  const safeDays = Math.min(Math.max(Number(days) || 30, 1), 365);

  const [summaryRows, recentRows] = await Promise.all([
    runStoreQuery(
      `
      SELECT
        COUNT(*)::int AS total_returns,
        COUNT(*) FILTER (WHERE r.status = :requestedStatus)::int AS requested_returns,
        COUNT(*) FILTER (WHERE r.status = :approvedStatus)::int AS approved_returns,
        COUNT(*) FILTER (WHERE r.status = :rejectedStatus)::int AS rejected_returns,
        COUNT(*) FILTER (WHERE r.status = :completedStatus)::int AS completed_returns,
        ROUND(
          COALESCE(
            SUM(r.refund_amount) FILTER (WHERE r.status = :completedStatus),
            0
          )::numeric,
          2
        ) AS total_refunded
      FROM order_returns r
      JOIN stores s ON r.store_id = s.id
      WHERE s.store_name = :storeName
        AND r.created_at >= NOW() - (:days || ' days')::interval
      `,
      {
        requestedStatus: RETURN_STATUSES.REQUESTED,
        approvedStatus: RETURN_STATUSES.APPROVED,
        rejectedStatus: RETURN_STATUSES.REJECTED,
        completedStatus: RETURN_STATUSES.COMPLETED,
        days: safeDays,
      },
      storeName,
      "tool-get-returns-summary"
    ),
    runStoreQuery(
      `
      SELECT
        o.order_number,
        r.status,
        r.refund_status,
        r.refund_amount,
        r.reason,
        r.created_at
      FROM order_returns r
      JOIN orders o ON r.order_id = o.id
      JOIN stores s ON r.store_id = s.id
      WHERE s.store_name = :storeName
        AND r.created_at >= NOW() - (:days || ' days')::interval
      ORDER BY r.created_at DESC
      LIMIT :limit
      `,
      { days: safeDays, limit: safeLimit },
      storeName,
      "tool-get-returns-recent"
    ),
  ]);

  return {
    days: safeDays,
    summary: summaryRows[0] ?? {},
    recent_returns: recentRows,
  };
};

export { getReturnsSummary };
