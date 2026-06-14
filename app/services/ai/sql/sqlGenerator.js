import { queryChatComplete } from "../provider.js";
import { buildSqlGenerationPrompt } from "../../../utils/prompt.js";
import { throwError } from "../../../lib/throwError.js";
import { extractSelectStatement, stripMarkdownFromSql } from "./sqlCleaner.js";
import { sanitizeGeneratedSQL } from "./sqlSecurity.js";
import { ensureStoreScope } from "./sqlStoreScope.js";

const generateSmartBusinessSQL = async (question, storeName) => {
  try {
    if (!storeName || storeName.trim().length === 0) {
      throw new Error("Invalid store name");
    }

    const rawSqlContent = await queryChatComplete(
      buildSqlGenerationPrompt(question, storeName),
      { traceName: "sql-generation" }
    );
    const sqlContent = stripMarkdownFromSql(rawSqlContent);
    const selectStatement = extractSelectStatement(sqlContent);

    if (!selectStatement) {
      throwError("No valid SQL query found in AI response", 500);
    }

    const scopedSql = ensureStoreScope(selectStatement, storeName);
    return sanitizeGeneratedSQL(scopedSql, storeName);
  } catch (error) {
    if (error.statusCode) throw error;
    throwError(`Smart SQL generation failed: ${error.message}`, 500);
  }
};

export { generateSmartBusinessSQL };
