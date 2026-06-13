import { throwError } from "../../../lib/throwError.js";

const isLiteralSelect = (sql) => !/\bfrom\b/i.test(sql);

const scopeLiteralSelect = (sql, storeName) => {
  if (sql.includes(storeName)) {
    return sql;
  }

  let scoped = sql.trim().replace(/;$/, "");

  if (/\blimit\b/i.test(scoped)) {
    return scoped.replace(
      /\blimit\b/i,
      `, '${storeName}' AS store_name LIMIT`
    );
  }

  return `${scoped}, '${storeName}' AS store_name`;
};

const ensureStoreScope = (sql, storeName) => {
  if (sql.includes(storeName)) {
    return sql;
  }

  if (isLiteralSelect(sql)) {
    return scopeLiteralSelect(sql, storeName);
  }

  let scoped = sql.trim().replace(/;$/, "");

  if (/\bfrom\s+products\b/i.test(scoped) && !/\bstores\b/i.test(scoped)) {
    scoped = scoped.replace(/\bfrom\s+products\s+(\w+)?\b/i, (_, alias) => {
      const productAlias = alias?.trim() || "p";
      return `FROM products ${productAlias} JOIN stores s ON ${productAlias}.store_id = s.id`;
    });
  }

  if (!/\bstores\s+s\b/i.test(scoped) && /\bfrom\s+stores\b/i.test(scoped)) {
    scoped = scoped.replace(/\bfrom\s+stores\s+(\w+)?\b/i, (_, alias) => {
      const storeAlias = alias?.trim() || "s";
      if (storeAlias === "s") {
        return "FROM stores s";
      }
      return `FROM stores ${storeAlias}`;
    });
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

export { ensureStoreScope, isLiteralSelect, scopeLiteralSelect };
