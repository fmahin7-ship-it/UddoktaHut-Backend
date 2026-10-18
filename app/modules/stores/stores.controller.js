import {
  getStoreProducts,
  updateStoreTemplate,
  getOwnerStoreInfo,
} from "./stores.service.js";

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

export { getPublicStoreProducts, updateTemplate, getOwnerStore };
