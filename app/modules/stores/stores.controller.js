import {
  getStoreProducts,
  updateStoreTemplate,
  getOwnerStoreInfo,
} from "./stores.service.js";
import { createStoreOrder } from "../orders/orders.service.js";

const getPublicStoreProducts = async (req, res, next) => {
  try {
    const storeName = req.params.storeName;
    const result = await getStoreProducts(storeName, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getOwnerStore = async (req, res, next) => {
  try {
    const storeName = req.params.storeName;
    const result = await getOwnerStoreInfo(storeName);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const updateTemplate = async (req, res, next) => {
  try {
    const storeName = req.params.storeName;
    const { templateName } = req.body;
    const userId = req.user.id;
    const result = await updateStoreTemplate(storeName, templateName, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const placeStoreOrder = async (req, res, next) => {
  try {
    const order = await createStoreOrder(req.params.storeName, req.body);
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

export { getPublicStoreProducts, updateTemplate, getOwnerStore, placeStoreOrder };
