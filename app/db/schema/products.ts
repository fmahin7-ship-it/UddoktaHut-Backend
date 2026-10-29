import {
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { stores } from "./stores.ts";
import { users } from "./users.ts";

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  image: varchar("image"),
  /** Returned as string by node-pg; do not `+` these — coerce with Number/Decimal. Prefer integer minor units later. */
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  stock: integer("stock").notNull(),
  status: varchar("status").notNull(),
  category: varchar("category").notNull(),
  sku: varchar("sku").notNull(),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  store_id: integer("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
