/** OpenAI tool schemas — LLM sees these; SQL lives in handlers only. */
const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "get_store_summary",
      description:
        "Store profile: name, type, address, template, created date, and total product count. Use for store info or overview questions.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product_stats",
      description:
        "Aggregate product metrics: total, active, out of stock (stock <= 0), average price, total stock units. Use for summary or overview questions.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_products",
      description:
        "List products for the store, newest first. Optional category filter. Use to show catalog items or inspect individual prices/stock.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Max rows (1-50, default 20)",
          },
          category: {
            type: "string",
            description: "Optional exact category name filter",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_low_stock_products",
      description:
        "Products with low inventory (stock strictly below threshold, default 5). Use for restock and low-stock questions. Does NOT predict when stock will run out — only current quantity.",
      parameters: {
        type: "object",
        properties: {
          threshold: {
            type: "integer",
            description: "Stock strictly below this number (default 5)",
          },
          limit: {
            type: "integer",
            description: "Max rows (1-50, default 20)",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_categories_breakdown",
      description:
        "Product count and average price grouped by category. Use for category comparisons and pricing insight questions (not full strategy without sales/cost data).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_order_summary",
      description:
        "Order and sales aggregates for the store: order count, revenue, average order value, and counts by status (pending, confirmed, delivered, cancelled). Use for sales, revenue, and order volume questions.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "7d", "30d", "all"],
            description: "Time window (default 30d)",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_orders",
      description:
        "List the most recent customer orders with order number, customer, total, status, and date. Use for latest orders or order list questions.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Max rows (1-20, default 10)",
          },
          status: {
            type: "string",
            description:
              "Optional order status filter: pending, confirmed, shipped, delivered, cancelled, partially_returned, returned",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_selling_products",
      description:
        "Best-selling products by units sold and revenue from completed orders in a time window. Use for bestsellers and what sold most questions.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Max rows (1-20, default 10)",
          },
          days: {
            type: "integer",
            description: "Lookback days (1-365, default 30)",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_returns_summary",
      description:
        "Return and refund summary: counts by return status, total refunded amount, and recent return requests. Use for returns, refunds, and RMA questions.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Max recent returns to list (1-20, default 10)",
          },
          days: {
            type: "integer",
            description: "Lookback days (1-365, default 30)",
          },
        },
        additionalProperties: false,
      },
    },
  },
];

const getToolDefinitions = (toolNames = null) => {
  if (!toolNames?.length) {
    return TOOL_DEFINITIONS;
  }

  const allowed = new Set(toolNames);
  return TOOL_DEFINITIONS.filter((tool) => allowed.has(tool.function.name));
};

export { TOOL_DEFINITIONS, getToolDefinitions };
