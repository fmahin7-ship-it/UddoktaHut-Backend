import { querySelect } from "../../../../db/sql.ts";
import { throwError } from "../../../../lib/throwError.ts";
import { withSpan } from "../../observability/aiTrace.ts";

const QUERY_TIMEOUT_MS = 5000;

/**
 * Parameterized SELECT for tool handlers.
 * storeName is always injected from auth context — never from LLM args.
 */
const runStoreQuery = async (
  sql: string,
  replacements: Record<string, unknown>,
  storeName: string,
  spanName = "tool-query"
): Promise<Record<string, unknown>[]> => {
  if (!storeName) {
    throwError("Store context required for tool query", 400);
  }

  return withSpan(spanName, { storeName }, async () => {
    try {
      const rows = await Promise.race([
        querySelect(sql, { ...replacements, storeName }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Query timeout")), QUERY_TIMEOUT_MS)
        ),
      ]);
      return (rows ?? []) as Record<string, unknown>[];
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "Query timeout") {
        return throwError("Database query timed out", 408);
      }
      return throwError(`Tool query failed: ${message}`, 500);
    }
  });
};

export { runStoreQuery };
