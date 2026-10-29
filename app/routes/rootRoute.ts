import type { Express } from "express";
import { authRoutes } from "../modules/auth/auth.routes.ts";
import { storeRoutes } from "../modules/stores/stores.routes.ts";
import { billingRoutes } from "../modules/billing/billing.routes.ts";
import { subscriptionRoutes } from "../modules/subscriptions/subscriptions.routes.ts";
import { userRoutes } from "../modules/users/users.routes.ts";
import productRoutes from "../modules/products/products.routes.ts";
import orderRoutes from "../modules/orders/orders.routes.ts";
import { aiRoutes } from "../modules/ai/ai.routes.ts";
import { planRoutes } from "../modules/plans/plans.routes.ts";

const rootRoute = (app: Express) => {
  app.use("/auth", authRoutes);
  app.use("/user", userRoutes);
  app.use("/store", storeRoutes);
  app.use("/subscription", billingRoutes);
  app.use("/subscription", subscriptionRoutes);
  app.use("/plans", planRoutes);
  app.use("/product", productRoutes);
  app.use("/orders", orderRoutes);
  app.use("/ai", aiRoutes);
};

export { rootRoute };
