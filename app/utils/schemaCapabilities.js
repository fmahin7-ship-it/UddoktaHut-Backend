const AVAILABLE_DATA = {
  products: [
    "product name, category, price, stock, status, SKU",
    "product counts and aggregates by category",
    "inventory levels (stock column)",
  ],
  store: ["store name, type, address, template, created date"],
  subscription: ["plan, status, trial and billing dates"],
  owner: ["owner name and email (via users + stores join)"],
};

const UNAVAILABLE_DATA = [
  "order history and order items",
  "units sold or items sold",
  "revenue, profit, or sales totals",
  "refunds, returns, or cancellations",
  "customer purchase behavior or conversion rates",
  "shipping or delivery tracking",
];

const buildDataAvailabilityBlock = () => `
DATA AVAILABILITY (authoritative — never contradict this):

What the system CAN answer from the database:
${Object.entries(AVAILABLE_DATA)
  .map(([area, items]) => `- ${area}: ${items.join("; ")}`)
  .join("\n")}

What the system CANNOT answer (tables do not exist):
${UNAVAILABLE_DATA.map((item) => `- ${item}`).join("\n")}
`;

const SQL_GENERATION_DATA_RULES = `
DATA HONESTY RULES FOR SQL GENERATION:
1. Only query tables defined in the schema. Never invent tables or columns.
2. If the question needs UNAVAILABLE data above, do NOT pretend to measure sales/orders/revenue.
3. When a related proxy exists, use honest column aliases only, for example:
   - product_count, category_name, total_stock, avg_price, active_product_count
4. NEVER use misleading aliases such as: sold, units_sold, total_sold, sales, revenue, profit, orders_count (unless querying subscriptions status only).
5. If no meaningful proxy can answer the question, return exactly:
   SELECT 'NOT_AVAILABLE' AS data_status, 'This data is not stored in the system yet' AS message LIMIT 1
6. ORDER BY proxy metrics DESC when ranking (e.g. highest product_count by category).
`;

const SQL_ANALYSIS_DATA_RULES = `
DATA HONESTY RULES FOR ANSWERING:
1. Read "SQL executed" and "Result data" to determine what was ACTUALLY measured.
2. Describe results using the same meaning as the SQL/column names (product_count = number of products, NOT items sold).
3. If the user asked for sales/revenue/orders but the SQL used product or stock aggregates:
   - Start with: "Sales/order data isn't stored in the system yet."
   - Then offer the available proxy with correct wording, e.g. "Apparel has 40 products in your catalog."
4. If data_status is NOT_AVAILABLE, explain what is missing and what analytics ARE available instead.
5. NEVER say "sold", "revenue", or "sales" unless the SQL and results genuinely represent that (they currently do not).
6. Do not invent numbers — only use values present in Result data.
7. For subjective questions ("best", "will shine", "recommend", "top pick"): explain you are using available catalog signals (stock, price, category) as a proxy, not sales performance.
8. Be concise.
`;

export {
  AVAILABLE_DATA,
  UNAVAILABLE_DATA,
  buildDataAvailabilityBlock,
  SQL_GENERATION_DATA_RULES,
  SQL_ANALYSIS_DATA_RULES,
};
