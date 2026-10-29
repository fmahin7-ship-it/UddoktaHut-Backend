import { requireUser } from "../../lib/requireUser.ts";
import type { AsyncRoute } from "../../types/http.ts";
import { createStoreOrder } from "../orders/orders.service.ts";
import {
  getStoreProducts,
  updateStoreTemplate,
  getOwnerStoreInfo,
} from "./stores.service.ts";

const getPublicStoreProducts: AsyncRoute = async (req, res, next) => {
  try {
    const storeName = String(req.params.storeName);
    const result = await getStoreProducts(storeName, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getOwnerStore: AsyncRoute = async (req, res, next) => {
  try {
    const storeName = String(req.params.storeName);
    const result = await getOwnerStoreInfo(storeName);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const updateTemplate: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    const storeName = String(req.params.storeName);
    const { templateName } = req.body as { templateName: string };
    const result = await updateStoreTemplate(storeName, templateName, user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const placeStoreOrder: AsyncRoute = async (req, res, next) => {
  try {
    const order = await createStoreOrder(
      String(req.params.storeName),
      req.body as {
        customer: { name: string; phone: string; address: string };
        items: Array<{ productId: number; quantity: number }>;
        paymentMethod?: string;
        note?: string;
      }
    );
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

export {
  getPublicStoreProducts,
  updateTemplate,
  getOwnerStore,
  placeStoreOrder,
};
