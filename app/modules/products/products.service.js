import { Product, Store } from "../../models/RootModel.js";
import { paginateQuery } from "../../lib/pagination.js";

const fetchAllProducts = async ({
  page = 1,
  pageSize = 10,
  search = "",
  sortBy = "id",
  sortOrder = "desc",
  userId,
}) => {
  return await paginateQuery(Product, {
    page,
    pageSize,
    search,
    searchFields: ["name", "category", "sku"],
    sortBy,
    sortOrder,
    where: { user_id: userId },
  });
};

const createProduct = async (data, userId) => {
  // Find the store by name and user
  const store = await Store.findOne({
    where: { store_name: data.storeName, user_id: userId },
  });
  if (!store) throw new Error("Store not found or not owned by user");
  // Remove storeName from data before creating product
  const { storeName, ...productData } = data;
  return await Product.create({
    ...productData,
    user_id: userId,
    store_id: store.id,
  });
};

const updateProduct = async (id, data, userId) => {
  const product = await Product.findOne({ where: { id, user_id: userId } });
  if (!product) throw new Error("Product not found or not owned by user");
  // Prevent updating user_id, store_id
  delete data.user_id;
  delete data.store_id;
  await product.update(data);
  return product;
};

const deleteProduct = async (productId, userId) => {
  const product = await Product.findOne({
    where: { id: productId, user_id: userId },
  });
  if (!product) {
    throw new Error("Product not found or not owned by user");
  }
  await product.destroy();
  return { message: "Product deleted successfully" };
};

export { fetchAllProducts, createProduct, updateProduct, deleteProduct };
