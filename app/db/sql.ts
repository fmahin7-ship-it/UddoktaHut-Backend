import { pool } from "./client.ts";

/**
 * Bind Sequelize-style :name placeholders to pg $1, $2, …
 * Skips Postgres casts (::int, ::numeric) via negative lookbehind.
 */
const bindNamedParams = (
  sql: string,
  replacements: Record<string, unknown>
): { text: string; values: unknown[] } => {
  const values: unknown[] = [];
  const indexByName = new Map<string, number>();

  const text = sql.replace(
    /(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g,
    (_match, name: string) => {
      if (!(name in replacements)) {
        // Leave unknown tokens alone (avoids turning accidental :words into $n).
        return `:${name}`;
      }
      if (!indexByName.has(name)) {
        indexByName.set(name, values.length + 1);
        values.push(replacements[name]);
      }
      return `$${indexByName.get(name)}`;
    }
  );

  return { text, values };
};

export const querySelect = async <TRow extends Record<string, unknown>>(
  sql: string,
  replacements: Record<string, unknown> = {}
): Promise<TRow[]> => {
  const { text, values } = bindNamedParams(sql, replacements);
  const result = await pool.query(text, values);
  return result.rows as TRow[];
};

export const queryExecute = async (
  sql: string,
  replacements: Record<string, unknown> = {}
): Promise<void> => {
  const { text, values } = bindNamedParams(sql, replacements);
  await pool.query(text, values);
};

const pgErrorCode = (err: unknown): string | undefined => {
  if (typeof err !== "object" || err === null) return undefined;
  if ("code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  if ("cause" in err) return pgErrorCode((err as { cause: unknown }).cause);
  return undefined;
};

export const isPgUniqueViolation = (err: unknown): boolean =>
  pgErrorCode(err) === "23505";

export { bindNamedParams };
