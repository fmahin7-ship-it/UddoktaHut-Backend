import { and, eq } from "drizzle-orm";
import { paginateActiveStoreProducts } from "../../lib/pagination.ts";
import { PRODUCT_STATUS } from "../../constants/productConstants.ts";
import { db } from "../../db/client.ts";
import { stores } from "../../db/schema/index.ts";

const getStoreProducts = async (
  storeName: string,
  query: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }
) => {
  const {
    page = 1,
    pageSize = 10,
    search = "",
    sortBy = "id",
    sortOrder = "desc",
  } = query;

  const result = await paginateActiveStoreProducts({
    storeName,
    page,
    pageSize,
    search,
    sortBy,
    sortOrder,
    status: PRODUCT_STATUS.ACTIVE,
  });

  const mapped = result.data.map((product) => {
    const { id, name, image, price, stock, status, category, sku } = product;
    return { id, name, image, price, stock, status, category, sku };
  });

  return {
    data: mapped,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  };
};

const getOwnerStoreInfo = async (storeName: string) => {
  const store = await db.query.stores.findFirst({
    where: eq(stores.store_name, storeName),
    columns: {
      store_name: true,
      template_name: true,
      store_type: true,
    },
  });
  if (!store) {
    throw new Error("Store not found");
  }
  return store;
};

const updateStoreTemplate = async (
  storeName: string,
  templateName: string,
  userId: number
) => {
  const store = await db.query.stores.findFirst({
    where: and(eq(stores.store_name, storeName), eq(stores.user_id, userId)),
  });
  if (!store) {
    throw new Error("Store not found or not owned by user");
  }
  const [updated] = await db
    .update(stores)
    .set({ template_name: templateName })
    .where(eq(stores.id, store.id))
    .returning();
  return updated;
};

export { getStoreProducts, updateStoreTemplate, getOwnerStoreInfo };
