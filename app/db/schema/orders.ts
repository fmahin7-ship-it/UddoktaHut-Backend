import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { products } from "./products.ts";
import { stores } from "./stores.ts";

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  store_id: integer("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  order_number: varchar("order_number", { length: 32 }).notNull().unique(),
  customer_name: varchar("customer_name").notNull(),
  customer_phone: varchar("customer_phone", { length: 20 }).notNull(),
  customer_address: text("customer_address").notNull(),
  note: text("note"),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  payment_method: varchar("payment_method", { length: 32 }).notNull().default("cod"),
  payment_status: varchar("payment_status", { length: 32 }).notNull().default("unpaid"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  order_id: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  product_id: integer("product_id")
    .notNull()
    .references(() => products.id),
  product_name: varchar("product_name").notNull(),
  unit_price: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  line_total: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const orderReturns = pgTable("order_returns", {
  id: serial("id").primaryKey(),
  order_id: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  store_id: integer("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 32 }).notNull().default("requested"),
  reason: text("reason"),
  merchant_note: text("merchant_note"),
  refund_status: varchar("refund_status", { length: 32 }).notNull().default("none"),
  refund_amount: numeric("refund_amount", { precision: 12, scale: 2 }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const orderReturnItems = pgTable("order_return_items", {
  id: serial("id").primaryKey(),
  return_id: integer("return_id")
    .notNull()
    .references(() => orderReturns.id, { onDelete: "cascade" }),
  order_item_id: integer("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  quantity_returned: integer("quantity_returned").notNull(),
  restock: boolean("restock").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
