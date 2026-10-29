import { relations } from "drizzle-orm";
import { aiUsageMonthly } from "./billing.ts";
import {
  orderItems,
  orderReturnItems,
  orderReturns,
  orders,
} from "./orders.ts";
import { planPrices, plans, subscriptions } from "./plans.ts";
import { products } from "./products.ts";
import { stores } from "./stores.ts";
import { roles, userRoles, users } from "./users.ts";

export const usersRelations = relations(users, ({ many, one }) => ({
  roleAssignments: many(userRoles),
  store: one(stores, {
    fields: [users.id],
    references: [stores.user_id],
  }),
  products: many(products),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.user_id], references: [users.id] }),
  role: one(roles, { fields: [userRoles.role_id], references: [roles.id] }),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  user: one(users, { fields: [stores.user_id], references: [users.id] }),
  subscription: one(subscriptions, {
    fields: [stores.id],
    references: [subscriptions.store_id],
  }),
  products: many(products),
  orders: many(orders),
  aiUsage: many(aiUsageMonthly),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
  prices: many(planPrices),
}));

export const planPricesRelations = relations(planPrices, ({ one }) => ({
  plan: one(plans, { fields: [planPrices.plan_id], references: [plans.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  store: one(stores, {
    fields: [subscriptions.store_id],
    references: [stores.id],
  }),
  plan: one(plans, { fields: [subscriptions.plan_id], references: [plans.id] }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  store: one(stores, { fields: [products.store_id], references: [stores.id] }),
  user: one(users, { fields: [products.user_id], references: [users.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  store: one(stores, { fields: [orders.store_id], references: [stores.id] }),
  items: many(orderItems),
  returns: many(orderReturns),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, { fields: [orderItems.order_id], references: [orders.id] }),
  product: one(products, {
    fields: [orderItems.product_id],
    references: [products.id],
  }),
  returnItems: many(orderReturnItems),
}));

export const orderReturnsRelations = relations(orderReturns, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderReturns.order_id],
    references: [orders.id],
  }),
  store: one(stores, {
    fields: [orderReturns.store_id],
    references: [stores.id],
  }),
  items: many(orderReturnItems),
}));

export const orderReturnItemsRelations = relations(orderReturnItems, ({ one }) => ({
  orderReturn: one(orderReturns, {
    fields: [orderReturnItems.return_id],
    references: [orderReturns.id],
  }),
  orderItem: one(orderItems, {
    fields: [orderReturnItems.order_item_id],
    references: [orderItems.id],
  }),
}));
