import { throwError } from "../../../lib/throwError.ts";
import { withSpan } from "../observability/aiTrace.ts";
import { getCategoriesBreakdown } from "./getCategoriesBreakdown.ts";
import { getLowStockProducts } from "./getLowStockProducts.ts";
import { getOrderSummary } from "./getOrderSummary.ts";
import { getProductStats } from "./getProductStats.ts";
import { getRecentOrders } from "./getRecentOrders.ts";
import { getReturnsSummary } from "./getReturnsSummary.ts";
import { getStoreSummary } from "./getStoreSummary.ts";
import { getTopSellingProducts } from "./getTopSellingProducts.ts";
import { listProducts } from "./listProducts.ts";

type ToolContext = { storeName: string };
type ToolHandler = (args: Record<string, unknown> & { storeName: string }) => Promise<unknown>;

const HANDLERS: Record<string, ToolHandler> = {
  get_store_summary: getStoreSummary as ToolHandler,
  get_product_stats: getProductStats as ToolHandler,
  list_products: listProducts as ToolHandler,
  get_low_stock_products: getLowStockProducts as ToolHandler,
  get_categories_breakdown: getCategoriesBreakdown as ToolHandler,
  get_order_summary: getOrderSummary as ToolHandler,
  get_recent_orders: getRecentOrders as ToolHandler,
  get_top_selling_products: getTopSellingProducts as ToolHandler,
  get_returns_summary: getReturnsSummary as ToolHandler,
};

const parseToolArgs = (rawArgs: string | null | undefined): Record<string, unknown> => {
  if (!rawArgs || rawArgs === "{}") return {};
  try {
    return JSON.parse(rawArgs) as Record<string, unknown>;
  } catch {
    return throwError("Tool arguments must be valid JSON", 400);
  }
};

/**
 * Execute a tool by name. storeName is injected from auth — never from LLM.
 */
const runTool = async (
  name: string,
  rawArgs: string,
  ctx: ToolContext
): Promise<unknown> => {
  const handler = HANDLERS[name];
  if (!handler) {
    return throwError(`Unknown tool: ${name}`, 400);
  }

  const args = parseToolArgs(rawArgs);

  return withSpan(`tool-${name}`, { args }, async () => {
    const result = await handler({ ...args, storeName: ctx.storeName });
    return result;
  });
};

export { runTool, HANDLERS };
