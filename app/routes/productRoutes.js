import { Router } from "express";
import {
  getAllProducts,
  addProduct,
  editProduct,
  removeProduct,
} from "../controllers/productController.js";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { checkOwnerSubscription } from "../middleware/subscriptionMiddleware.js";
import { requireProductCreateSlot } from "../middleware/entitlementMiddleware.js";
import { paginationQuerySchema } from "../validations/paginationSchema.js";
import {
  productCreateSchema,
  productIdParamSchema,
  productUpdateSchema,
} from "../validations/productSchema.js";

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
