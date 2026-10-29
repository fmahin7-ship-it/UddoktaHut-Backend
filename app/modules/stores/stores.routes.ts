import express from "express";
import { validate } from "../../middleware/validateMiddleware.ts";
import {
  storeSchema,
  storeUpdateSchema,
} from "./stores.schema.ts";
import {
  getPublicStoreProducts,
  updateTemplate,
  getOwnerStore,
  placeStoreOrder,
} from "./stores.controller.ts";
import { paginationQuerySchema } from "../../validations/paginationSchema.ts";
import { createOrderSchema } from "../orders/orders.schema.ts";
import { authenticateUser } from "../../middleware/authMiddleware.ts";
import {
  checkOwnerSubscription,
  checkStoreSubscription,
} from "../../middleware/subscriptionMiddleware.ts";

const storeRoutes = express.Router();

// Public routes
storeRoutes.get(
  "/:storeName/products",
  validate(storeSchema, "params"),
  checkStoreSubscription,
  validate(paginationQuerySchema, "query"),
  getPublicStoreProducts
);

storeRoutes.post(
  "/:storeName/orders",
  validate(storeSchema, "params"),
  checkStoreSubscription,
  validate(createOrderSchema, "body"),
  placeStoreOrder
);

storeRoutes.get(
  "/:storeName",
  authenticateUser,
  checkOwnerSubscription,
  validate(storeSchema, "params"),
  getOwnerStore
);

// Protected routes
storeRoutes.patch(
  "/:storeName/template",
  authenticateUser,
  checkOwnerSubscription,
  validate(storeSchema, "params"),
  validate(storeUpdateSchema, "body"),
  updateTemplate
);

export { storeRoutes };
