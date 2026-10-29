import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { stores } from "./stores.ts";

export const aiUsageMonthly = pgTable("ai_usage_monthly", {
  id: serial("id").primaryKey(),
  store_id: integer("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  period: varchar("period", { length: 7 }).notNull(),
  tokens_used: integer("tokens_used").notNull().default(0),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const billingWebhookEvents = pgTable(
  "billing_webhook_events",
  {
    id: serial("id").primaryKey(),
    provider: varchar("provider").notNull().default("stripe"),
    event_id: varchar("event_id").notNull(),
    event_type: varchar("event_type").notNull(),
    payload_json: jsonb("payload_json"),
    processed_at: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("billing_webhook_events_provider_event_uidx").on(
      table.provider,
      table.event_id
    ),
  ]
);
