import {
  boolean,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { stores } from "./stores.ts";

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  name: varchar("name").notNull(),
  billing_cycle: varchar("billing_cycle").notNull(),
  /** Market amounts live in plan_prices — do not re-add a price column here. */
  max_products: integer("max_products").notNull().default(20),
  includes_ai: boolean("includes_ai").notNull().default(false),
  ai_token_limit_monthly: integer("ai_token_limit_monthly").notNull().default(0),
});

export const planPrices = pgTable(
  "plan_prices",
  {
    id: serial("id").primaryKey(),
    plan_id: integer("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    market: varchar("market", { length: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    amount: integer("amount").notNull(),
    gateway_price_id: varchar("gateway_price_id"),
    is_active: boolean("is_active").notNull().default(true),
  },
  (table) => [uniqueIndex("plan_prices_plan_market_uidx").on(table.plan_id, table.market)]
);

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  store_id: integer("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  status: varchar("status"),
  start_date: timestamp("start_date", { withTimezone: true }).defaultNow(),
  trial_ends_at: timestamp("trial_ends_at", { withTimezone: true }),
  end_date: timestamp("end_date", { withTimezone: true }),
  is_auto_renew: boolean("is_auto_renew").default(false),
  plan_id: integer("plan_id").references(() => plans.id),
  stripe_customer_id: varchar("stripe_customer_id"),
  stripe_subscription_id: varchar("stripe_subscription_id"),
  billing_provider: varchar("billing_provider"),
  cancel_at_period_end: boolean("cancel_at_period_end").notNull().default(false),
});
