import { customType } from "drizzle-orm/pg-core";

/** pgvector column used by intent routing. Stored/queried as a float array. */
export const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string) {
    if (Array.isArray(value)) return value as number[];
    const raw = String(value).replace(/^\[/, "").replace(/\]$/, "");
    if (!raw) return [];
    return raw.split(",").map((part) => Number(part));
  },
});
