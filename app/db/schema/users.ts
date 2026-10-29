import { boolean, integer, pgTable, serial, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email"),
  phone_number: varchar("phone_number"),
  name: varchar("name").notNull(),
  password: varchar("password").notNull(),
});

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  role_name: varchar("role_name").notNull(),
});

export const userRoles = pgTable("user_roles", {
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role_id: integer("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  onboarded: boolean("onboarded").notNull(),
});
