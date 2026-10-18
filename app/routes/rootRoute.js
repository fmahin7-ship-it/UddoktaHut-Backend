import { authRoutes } from "../modules/auth/auth.routes.js";
import { storeRoutes } from "../modules/stores/stores.routes.js";
import { billingRoutes } from "../modules/billing/billing.routes.js";
import { subscriptionRoutes } from "../modules/subscriptions/subscriptions.routes.js";
import { userRoutes } from "../modules/users/users.routes.js";
import productRoutes from "../modules/products/products.routes.js";
import orderRoutes from "../modules/orders/orders.routes.js";
import { aiRoutes } from "../modules/ai/ai.routes.js";
import { planRoutes } from "../modules/plans/plans.routes.js";

const rootRoute = (app) => {
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
