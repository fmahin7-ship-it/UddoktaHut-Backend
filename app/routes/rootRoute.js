import { authRoutes } from "./authRoutes.js";
import { storeRoutes } from "./storeRoutes.js";
import { subscriptionRoutes } from "./subscriptionRoutes.js";
import { userRoutes } from "./userRoutes.js";
import productRoutes from "./productRoutes.js";
import orderRoutes from "./orderRoutes.js";
import { aiRoutes } from "./aiRoutes.js";

const rootRoute = (app) => {
  app.use("/auth", authRoutes);
  app.use("/user", userRoutes);
  app.use("/store", storeRoutes);
  app.use("/subscription", subscriptionRoutes);
  app.use("/product", productRoutes);
  app.use("/orders", orderRoutes);
  app.use("/ai", aiRoutes);
};

export { rootRoute };
