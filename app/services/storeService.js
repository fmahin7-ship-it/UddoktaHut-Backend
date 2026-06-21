import { paginateQuery } from "../lib/pagination.js";
import { PRODUCT_STATUS } from "../constants/productConstants.js";
import { Store, Product } from "../models/RootModel.js";

const getStoreProducts = async (storeName, query) => {
  const {
    page = 1,
    pageSize = 10,
    search = "",
    sortBy = "id",
    sortOrder = "desc",
  } = query;

  const result = await paginateQuery(Product, {
    page,
    pageSize,
    search,
    searchFields: ["name", "category", "sku"],
    sortBy,
    sortOrder,
    include: [
      {
        model: Store,
        where: { store_name: storeName },
        attributes: [],
      },
    ],
    where: { status: PRODUCT_STATUS.ACTIVE },
  });

  const products = result.data.map((product) => {
    const { id, name, image, price, stock, status, category, sku } =
      product.get({ plain: true });
    return { id, name, image, price, stock, status, category, sku };
  });

  return {
    data: products,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  };
};

const getOwnerStoreInfo = async (storeName) => {
  const store = await Store.findOne({
    where: { store_name: storeName },
    attributes: ["store_name", "template_name", "store_type"],
  });
  if (!store) {
    throw new Error("Store not found");
  }
  return store.get({ plain: true });
};

const updateStoreTemplate = async (storeName, templateName, userId) => {
  const store = await Store.findOne({
    where: { store_name: storeName, user_id: userId },
  });
  if (!store) {
    throw new Error("Store not found or not owned by user");
  }
  await store.update({ template_name: templateName });
  return store.get({ plain: true });
};

export { getStoreProducts, updateStoreTemplate, getOwnerStoreInfo };
