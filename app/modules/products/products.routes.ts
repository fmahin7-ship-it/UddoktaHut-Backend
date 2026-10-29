import { Router } from "express";
import {
  getAllProducts,
  addProduct,
  editProduct,
  removeProduct,
} from "./products.controller.ts";
import { authenticateUser } from "../../middleware/authMiddleware.ts";
import { validate } from "../../middleware/validateMiddleware.ts";
import { checkOwnerSubscription } from "../../middleware/subscriptionMiddleware.ts";
import { requireProductCreateSlot } from "../../middleware/entitlementMiddleware.ts";
import { paginationQuerySchema } from "../../validations/paginationSchema.ts";
import {
  productCreateSchema,
  productIdParamSchema,
  productUpdateSchema,
} from "./products.schema.ts";

const router = Router();

router.get(
  "/",
  authenticateUser,
  checkOwnerSubscription,
  validate(paginationQuerySchema, "query"),
  getAllProducts
);

router.post(
  "/",
  authenticateUser,
  requireProductCreateSlot,
  validate(productCreateSchema, "body"),
  addProduct
);

router.patch(
  "/:id",
  authenticateUser,
  checkOwnerSubscription,
  validate(productUpdateSchema, "body"),
  editProduct
);

router.delete(
  "/:id",
  authenticateUser,
  checkOwnerSubscription,
  validate(productIdParamSchema, "params"),
  removeProduct
);

export default router;
