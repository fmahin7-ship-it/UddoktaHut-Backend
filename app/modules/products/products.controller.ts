import { requireUser } from "../../lib/requireUser.ts";
import type { AsyncRoute } from "../../types/http.ts";
import {
  fetchAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "./products.service.ts";

const addProduct: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    const product = await createProduct(
      req.body as Record<string, unknown> & { storeName: string },
      user.id
    );
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

const getAllProducts: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    const query = req.query as {
      search?: string;
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: string;
    };
    const result = await fetchAllProducts({
      ...query,
      search: query.search ?? "",
      userId: user.id,
    });
    res.json({
      data: result.data,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (err) {
    next(err);
  }
};

const editProduct: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    const product = await updateProduct(
      Number(req.params.id),
      req.body as Record<string, unknown>,
      user.id
    );
    res.json(product);
  } catch (err) {
    next(err);
  }
};

const removeProduct: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    const result = await deleteProduct(Number(req.params.id), user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export { getAllProducts, addProduct, editProduct, removeProduct };
