import { integer, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users.ts";

export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  store_name: varchar("store_name").notNull().unique(),
  store_url: varchar("store_url").notNull().unique(),
  store_type: varchar("store_type").notNull(),
  store_address: varchar("store_address"),
  country: varchar("country", { length: 2 }).notNull().default("BD"),
  template_name: varchar("template_name").default("default"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
