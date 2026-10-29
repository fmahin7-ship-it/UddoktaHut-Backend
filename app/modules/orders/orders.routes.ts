import { Router } from "express";
import {
  getOrders,
  getOrderById,
  patchOrderStatus,
  postOrderReturn,
  getReturnsForOrder,
  patchReturnStatus,
} from "./orders.controller.ts";
import { authenticateUser } from "../../middleware/authMiddleware.ts";
import { checkOwnerSubscription } from "../../middleware/subscriptionMiddleware.ts";
import { validate } from "../../middleware/validateMiddleware.ts";
import {
  createOrderReturnSchema,
  orderIdParamSchema,
  orderListQuerySchema,
  returnIdParamSchema,
  updateOrderStatusSchema,
  updateReturnStatusSchema,
} from "./orders.schema.ts";

const orderRoutes = Router();

orderRoutes.get(
  "/",
  authenticateUser,
  checkOwnerSubscription,
  validate(orderListQuerySchema, "query"),
  getOrders
);

orderRoutes.patch(
  "/returns/:returnId",
  authenticateUser,
  checkOwnerSubscription,
  validate(returnIdParamSchema, "params"),
  validate(updateReturnStatusSchema, "body"),
  patchReturnStatus
);

orderRoutes.get(
  "/:id",
  authenticateUser,
  checkOwnerSubscription,
  validate(orderIdParamSchema, "params"),
  getOrderById
);

orderRoutes.patch(
  "/:id/status",
  authenticateUser,
  checkOwnerSubscription,
  validate(orderIdParamSchema, "params"),
  validate(updateOrderStatusSchema, "body"),
  patchOrderStatus
);

orderRoutes.post(
  "/:id/returns",
  authenticateUser,
  checkOwnerSubscription,
  validate(orderIdParamSchema, "params"),
  validate(createOrderReturnSchema, "body"),
  postOrderReturn
);

orderRoutes.get(
  "/:id/returns",
  authenticateUser,
  checkOwnerSubscription,
  validate(orderIdParamSchema, "params"),
  getReturnsForOrder
);

export default orderRoutes;
