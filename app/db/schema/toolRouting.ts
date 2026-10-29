import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { vector1536 } from "./vector.ts";

export const toolRouting = pgTable("tool_routing", {
  id: serial("id").primaryKey(),
  example_question: text("example_question").notNull(),
  tool_name: varchar("tool_name", { length: 64 }).notNull(),
  locale: varchar("locale", { length: 8 }).notNull().default("any"),
  embedding: vector1536("embedding").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
