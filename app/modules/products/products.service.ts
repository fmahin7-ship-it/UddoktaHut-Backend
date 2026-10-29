import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { products, stores } from "../../db/schema/index.ts";
import { paginateUserProducts } from "../../lib/pagination.ts";

const fetchAllProducts = async ({
  page = 1,
  pageSize = 10,
  search = "",
  sortBy = "id",
  sortOrder = "desc",
  userId,
}: {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  userId: number;
}) =>
  paginateUserProducts({
    page,
    pageSize,
    search,
    sortBy,
    sortOrder,
    userId,
  });

const createProduct = async (
  data: Record<string, unknown> & { storeName: string },
  userId: number
) => {
  const store = await db.query.stores.findFirst({
    where: and(
      eq(stores.store_name, data.storeName),
      eq(stores.user_id, userId)
    ),
  });
  if (!store) throw new Error("Store not found or not owned by user");

  const { storeName: _storeName, ...productData } = data;
  const now = new Date();
  const [created] = await db
    .insert(products)
    .values({
      ...(productData as typeof products.$inferInsert),
      user_id: userId,
      store_id: store.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return created;
};

const updateProduct = async (
  id: number,
  data: Record<string, unknown>,
  userId: number
) => {
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, id), eq(products.user_id, userId)),
  });
  if (!product) throw new Error("Product not found or not owned by user");

  delete data.user_id;
  delete data.store_id;

  const [updated] = await db
    .update(products)
    .set(data as Partial<typeof products.$inferInsert>)
    .where(eq(products.id, id))
    .returning();
  return updated;
};

const deleteProduct = async (productId: number, userId: number) => {
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.user_id, userId)),
  });
  if (!product) {
    throw new Error("Product not found or not owned by user");
  }
  await db.delete(products).where(eq(products.id, productId));
  return { message: "Product deleted successfully" };
};

export { fetchAllProducts, createProduct, updateProduct, deleteProduct };
