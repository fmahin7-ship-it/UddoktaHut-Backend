import { requireUser } from "../../lib/requireUser.ts";
import type { AsyncRoute } from "../../types/http.ts";
import {
  listStoreOrders,
  getStoreOrderById,
  updateOrderStatus,
  createOrderReturn,
  updateReturnStatus,
  listOrderReturns,
} from "./orders.service.ts";

const getOrders: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    const result = await listStoreOrders(user.id, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getOrderById: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    const order = await getStoreOrderById(user.id, Number(req.params.id));
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
};

const patchOrderStatus: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    const body = req.body as { status: string };
    const order = await updateOrderStatus(
      user.id,
      Number(req.params.id),
      body.status
    );
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
};

const postOrderReturn: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    const orderReturn = await createOrderReturn(
      user.id,
      Number(req.params.id),
      req.body
    );
    res.status(201).json({ success: true, data: orderReturn });
  } catch (err) {
    next(err);
  }
};

const getReturnsForOrder: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    const returns = await listOrderReturns(user.id, Number(req.params.id));
    res.json({ data: returns });
  } catch (err) {
    next(err);
  }
};

const patchReturnStatus: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    const orderReturn = await updateReturnStatus(
      user.id,
      Number(req.params.returnId),
      req.body
    );
    res.json({ data: orderReturn });
  } catch (err) {
    next(err);
  }
};

export {
  getOrders,
  getOrderById,
  patchOrderStatus,
  postOrderReturn,
  getReturnsForOrder,
  patchReturnStatus,
};
