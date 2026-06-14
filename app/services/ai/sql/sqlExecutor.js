import { QueryTypes } from "sequelize";
import { sequelize } from "../../../config/database.js";
import { throwError } from "../../../lib/throwError.js";
import { withSpan } from "../observability/aiTrace.js";

const QUERY_TIMEOUT_MS = 5000;

const executeSecureSQL = async (sqlQuery, storeName) => {
  try {
    console.log("🔍 DEBUG - Executing SQL:", sqlQuery);
    console.log("🔍 DEBUG - Store Name:", storeName);

    if (!sqlQuery || typeof sqlQuery !== "string") {
      throwError("Invalid SQL query", 400);
    }

    if (!sqlQuery.includes(storeName.toString())) {
      throwError("Query must include store ID for security", 400);
    }

    const results = await Promise.race([
      sequelize.query(sqlQuery, { type: QueryTypes.SELECT }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Query timeout")), QUERY_TIMEOUT_MS)
      ),
    ]);

    console.log("🔍 DEBUG - Query Results:", results);
    return results;
  } catch (error) {
    if (error.message === "Query timeout") {
      throwError("Database query timed out", 408);
    }
    throwError(`Database query failed: ${error.message}`, 500);
  }
};

const fetchBusinessData = async (sqlQuery, storeName) => {
  try {
    return await withSpan(
      "postgres-query",
      { sqlQuery, storeName },
      async () => executeSecureSQL(sqlQuery, storeName)
    );
  } catch (error) {
    if (error.statusCode) throw error;
    throwError(`Data retrieval failed: ${error.message}`, 500);
  }
};

export { executeSecureSQL, fetchBusinessData };
