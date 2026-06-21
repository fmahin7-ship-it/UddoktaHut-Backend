import { runStoreQuery } from "./sql/runStoreQuery.js";

const getStoreSummary = async ({ storeName }) => {
  const rows = await runStoreQuery(
    `
    SELECT
      s.store_name,
      s.store_type,
      s.store_address,
      s.template_name,
      s.created_at,
      COUNT(p.id)::int AS product_count
    FROM stores s
    LEFT JOIN products p ON p.store_id = s.id
    WHERE s.store_name = :storeName
    GROUP BY s.id, s.store_name, s.store_type, s.store_address, s.template_name, s.created_at
    LIMIT 1
    `,
    {},
    storeName,
    "tool-get-store-summary"
  );

  return rows[0] ?? null;
};

export { getStoreSummary };
