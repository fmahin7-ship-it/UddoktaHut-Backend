import { forbidden } from "../../../utils/constant.js";
import { throwError } from "../../../lib/throwError.js";

const THREAT_PATTERNS = [
  (sql, storeName) => sql.includes(`store_id != ${storeName}`),
  (sql, storeName) => sql.includes(`store_id <> ${storeName}`),
  (sql) => sql.includes("store_id in ("),
  (sql) => sql.includes("store_id > 0"),
  (sql) => sql.includes("store_id >= 1"),
  (sql) => sql.includes("store_id is not null"),
  (sql) => sql.includes("1=1"),
  (sql) => /\bwhere\s+true\b/.test(sql),
  (sql) => /\bor\s+true\b/.test(sql),
  (sql) => /\band\s+true\b/.test(sql),
  (sql) => sql.includes("or store_id"),
  (sql) => sql.includes("union select"),
  (sql) => /\bwhere\s+1\b/.test(sql),
  (sql) => sql.includes("; select"),
  (sql) => sql.includes("-- "),
  (sql) => sql.includes("/*"),
];

const sanitizeGeneratedSQL = (cleanSQL, storeName) => {
  const upperSQL = cleanSQL.toUpperCase();
  const lowerSQL = cleanSQL.toLowerCase();

  for (const word of forbidden) {
    if (upperSQL.includes(word)) {
      throwError(`Forbidden SQL operation detected: ${word}`, 400);
    }
  }

  for (const matchesThreat of THREAT_PATTERNS) {
    if (matchesThreat(lowerSQL, storeName)) {
      throwError(
        "Security violation detected: Query may access unauthorized data",
        400
      );
    }
  }

  if (!upperSQL.startsWith("SELECT")) {
    throwError("Only SELECT queries are allowed", 400);
  }

  if (!cleanSQL.includes(storeName)) {
    throwError("Query must include the specific store name for security", 400);
  }

  if (!upperSQL.includes("LIMIT")) {
    return `${cleanSQL} LIMIT 100`;
  }

  return cleanSQL;
};

export { sanitizeGeneratedSQL };
