import { QueryTypes } from "sequelize";
import { sequelize } from "../../../../config/database.js";
import { throwError } from "../../../../lib/throwError.js";
import { withSpan } from "../../observability/aiTrace.js";

const QUERY_TIMEOUT_MS = 5000;

/**
 * Parameterized SELECT for tool handlers.
 * storeName is always injected from auth context — never from LLM args.
 */
const runStoreQuery = async (sql, replacements, storeName, spanName = "tool-query") => {
  if (!storeName) {
    throwError("Store context required for tool query", 400);
  }

  return withSpan(spanName, { storeName }, async () => {
    try {
      return await Promise.race([
        sequelize.query(sql, {
          replacements: { ...replacements, storeName },
          type: QueryTypes.SELECT,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Query timeout")), QUERY_TIMEOUT_MS)
        ),
      ]);
    } catch (error) {
      if (error.message === "Query timeout") {
        throwError("Database query timed out", 408);
      }
      throwError(`Tool query failed: ${error.message}`, 500);
    }
  });
};

export { runStoreQuery };
