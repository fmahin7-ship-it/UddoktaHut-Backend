import { forbidden } from "../../../utils/constant.js";
import { throwError } from "../../../lib/throwError.js";

const buildSecurityThreats = (storeName) => [
  `store_id != ${storeName}`,
  `store_id <> ${storeName}`,
  "store_id in (",
  "store_id > 0",
  "store_id >= 1",
  "store_id is not null",
  "1=1",
  "true",
  "or store_id",
  "union select",
  "where 1",
  "; select",
  "-- ",
  "/*",
];

const sanitizeGeneratedSQL = (cleanSQL, storeName) => {
  const upperSQL = cleanSQL.toUpperCase();
  const lowerSQL = cleanSQL.toLowerCase();

  for (const word of forbidden) {
    if (upperSQL.includes(word)) {
      throwError(`Forbidden SQL operation detected: ${word}`, 400);
    }
  }

  for (const threat of buildSecurityThreats(storeName)) {
    if (lowerSQL.includes(threat.toLowerCase())) {
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
