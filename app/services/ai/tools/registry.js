import { throwError } from "../../../lib/throwError.js";
import { withSpan } from "../observability/aiTrace.js";
import { getStoreSummary } from "./getStoreSummary.js";
import { getProductStats } from "./getProductStats.js";
import { listProducts } from "./listProducts.js";
import { getLowStockProducts } from "./getLowStockProducts.js";
import { getCategoriesBreakdown } from "./getCategoriesBreakdown.js";
import { getOrderSummary } from "./getOrderSummary.js";
import { getRecentOrders } from "./getRecentOrders.js";
import { getTopSellingProducts } from "./getTopSellingProducts.js";
import { getReturnsSummary } from "./getReturnsSummary.js";

const HANDLERS = {
  get_store_summary: getStoreSummary,
  get_product_stats: getProductStats,
  list_products: listProducts,
  get_low_stock_products: getLowStockProducts,
  get_categories_breakdown: getCategoriesBreakdown,
  get_order_summary: getOrderSummary,
  get_recent_orders: getRecentOrders,
  get_top_selling_products: getTopSellingProducts,
  get_returns_summary: getReturnsSummary,
};

const parseToolArgs = (rawArgs) => {
  if (!rawArgs || rawArgs === "{}") return {};
  try {
    return JSON.parse(rawArgs);
  } catch {
    throwError("Tool arguments must be valid JSON", 400);
  }
};

/**
 * Execute a tool by name. storeName is injected from auth — never from LLM.
 */
const runTool = async (name, rawArgs, ctx) => {
  const handler = HANDLERS[name];
  if (!handler) {
    throwError(`Unknown tool: ${name}`, 400);
  }

  const args = parseToolArgs(rawArgs);

  return withSpan(`tool-${name}`, { args }, async () => {
    const result = await handler({ ...args, storeName: ctx.storeName });
    return result;
  });
};

export { runTool, HANDLERS };
