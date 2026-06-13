import { throwError } from "../../../lib/throwError.js";

const ensureStoreScope = (sql, storeName) => {
  if (sql.includes(storeName)) {
    return sql;
  }

  let scoped = sql.trim().replace(/;$/, "");

  if (/\bfrom\s+products\b/i.test(scoped) && !/\bstores\b/i.test(scoped)) {
    scoped = scoped.replace(
      /\bfrom\s+products\s+(\w+)?\b/i,
      (_, alias) => {
        const productAlias = alias?.trim() || "p";
        return `FROM products ${productAlias} JOIN stores s ON ${productAlias}.store_id = s.id`;
      }
    );
  }

  if (/\bwhere\b/i.test(scoped)) {
    scoped = scoped.replace(
      /\bwhere\b/i,
      `WHERE s.store_name = '${storeName}' AND`
    );
  } else {
    const clauseMatch = scoped.match(/\b(GROUP BY|ORDER BY|LIMIT)\b/i);
    if (clauseMatch) {
      const index = scoped.search(clauseMatch[0]);
      scoped = `${scoped.slice(0, index)} WHERE s.store_name = '${storeName}' ${scoped.slice(index)}`;
    } else {
      scoped = `${scoped} WHERE s.store_name = '${storeName}'`;
    }
  }

  if (!scoped.includes(storeName)) {
    throwError("Query must include the specific store name for security", 400);
  }

  return scoped;
};

export { ensureStoreScope };
