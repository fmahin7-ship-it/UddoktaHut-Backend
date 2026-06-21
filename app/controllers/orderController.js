import {
  createStoreOrder,
  listStoreOrders,
  getStoreOrderById,
  updateOrderStatus,
  createOrderReturn,
  updateReturnStatus,
  listOrderReturns,
} from "../services/orderService.js";

const placeStoreOrder = async (req, res, next) => {
  try {
    const order = await createStoreOrder(req.params.storeName, req.body);
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

const getOrders = async (req, res, next) => {
  try {
    const result = await listStoreOrders(req.user.id, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const order = await getStoreOrderById(req.user.id, req.params.id);
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
};

const patchOrderStatus = async (req, res, next) => {
  try {
    const order = await updateOrderStatus(
      req.user.id,
      req.params.id,
      req.body.status
    );
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
};

const postOrderReturn = async (req, res, next) => {
  try {
    const orderReturn = await createOrderReturn(
      req.user.id,
      req.params.id,
      req.body
    );
    res.status(201).json({ success: true, data: orderReturn });
  } catch (err) {
    next(err);
  }
};

const getReturnsForOrder = async (req, res, next) => {
  try {
    const returns = await listOrderReturns(req.user.id, req.params.id);
    res.json({ data: returns });
  } catch (err) {
    next(err);
  }
};

const patchReturnStatus = async (req, res, next) => {
  try {
    const orderReturn = await updateReturnStatus(
      req.user.id,
      req.params.returnId,
      req.body
    );
    res.json({ data: orderReturn });
  } catch (err) {
    next(err);
  }
};

export {
  placeStoreOrder,
  getOrders,
  getOrderById,
  patchOrderStatus,
  postOrderReturn,
  getReturnsForOrder,
  patchReturnStatus,
};
