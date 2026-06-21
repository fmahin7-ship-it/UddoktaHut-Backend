import { Op } from "sequelize";
import { throwError } from "../lib/throwError.js";
import {
  CANCELLABLE_STATUSES,
  MAX_LINE_QUANTITY,
  MAX_ORDER_LINES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  REFUND_STATUSES,
  RETURN_STATUSES,
  RETURNABLE_ORDER_STATUSES,
} from "../constants/orderConstants.js";
import {
  Order,
  OrderItem,
  OrderReturn,
  OrderReturnItem,
  Product,
  Store,
  sequelize,
} from "../models/RootModel.js";

import { PRODUCT_STATUS } from "../constants/productConstants.js";

const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

const generateOrderNumber = (storeId) => {
  const ts = Date.now().toString(36).toUpperCase();
  return `ORD-${storeId}-${ts}`;
};

const getOwnerStore = async (userId) => {
  const store = await Store.findOne({ where: { user_id: userId } });
  if (!store) {
    throwError("Store not found for authenticated user", 403);
  }
  return store;
};

const getStoreByName = async (storeName) => {
  const store = await Store.findOne({ where: { store_name: storeName } });
  if (!store) {
    throwError("Store not found", 404);
  }
  return store;
};

const orderIncludes = [
  {
    model: OrderItem,
    attributes: [
      "id",
      "product_id",
      "product_name",
      "unit_price",
      "quantity",
      "line_total",
    ],
  },
  {
    model: OrderReturn,
    attributes: [
      "id",
      "status",
      "reason",
      "merchant_note",
      "refund_status",
      "refund_amount",
      "created_at",
    ],
    include: [
      {
        model: OrderReturnItem,
        attributes: ["id", "order_item_id", "quantity_returned", "restock"],
      },
    ],
  },
];

const formatOrder = (order) => {
  const plain = order.get({ plain: true });
  const orderReturns = plain.OrderReturns?.map((ret) => ({
    ...ret,
    refund_amount:
      ret.refund_amount != null ? Number(ret.refund_amount) : null,
    OrderReturnItems: ret.OrderReturnItems,
  }));

  const totalRefunded = roundMoney(
    (orderReturns || [])
      .filter(
        (ret) =>
          ret.status === RETURN_STATUSES.COMPLETED &&
          ret.refund_status === REFUND_STATUSES.REFUNDED
      )
      .reduce((sum, ret) => sum + Number(ret.refund_amount || 0), 0)
  );
  const orderTotal = Number(plain.total);

  return {
    ...plain,
    subtotal: Number(plain.subtotal),
    total: orderTotal,
    total_refunded: totalRefunded,
    net_total: roundMoney(Math.max(0, orderTotal - totalRefunded)),
    OrderItems: plain.OrderItems?.map((item) => ({
      ...item,
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total),
    })),
    OrderReturns: orderReturns,
  };
};

const sumCompletedRefunds = async (orderId, transaction) => {
  const returns = await OrderReturn.findAll({
    where: {
      order_id: orderId,
      status: RETURN_STATUSES.COMPLETED,
      refund_status: REFUND_STATUSES.REFUNDED,
    },
    attributes: ["refund_amount"],
    transaction,
  });

  return roundMoney(
    returns.reduce((sum, ret) => sum + Number(ret.refund_amount || 0), 0)
  );
};

const resolvePaymentStatusAfterRefund = (orderTotal, totalRefunded) => {
  if (totalRefunded <= 0) {
    return null;
  }
  if (totalRefunded >= orderTotal) {
    return PAYMENT_STATUSES.REFUNDED;
  }
  return PAYMENT_STATUSES.PARTIALLY_REFUNDED;
};

const getReturnedQuantities = async (orderId, transaction) => {
  const rows = await OrderReturnItem.findAll({
    attributes: ["order_item_id", "quantity_returned"],
    include: [
      {
        model: OrderReturn,
        attributes: [],
        where: {
          order_id: orderId,
          status: RETURN_STATUSES.COMPLETED,
        },
      },
    ],
    transaction,
  });

  const map = new Map();
  for (const row of rows) {
    const current = map.get(row.order_item_id) ?? 0;
    map.set(row.order_item_id, current + row.quantity_returned);
  }
  return map;
};

const restoreOrderStock = async (orderItems, transaction) => {
  for (const item of orderItems) {
    await Product.increment("stock", {
      by: item.quantity,
      where: { id: item.product_id },
      transaction,
    });
  }
};

const createStoreOrder = async (storeName, payload) => {
  const store = await getStoreByName(storeName);
  const { customer, items, paymentMethod = PAYMENT_METHODS.COD, note } =
    payload;

  if (paymentMethod !== PAYMENT_METHODS.COD) {
    throwError("Only cash on delivery is supported", 400);
  }

  const productIds = items.map((item) => item.productId);
  const uniqueProductIds = new Set(productIds);
  if (uniqueProductIds.size !== productIds.length) {
    throwError("Duplicate product lines are not allowed", 400);
  }

  return sequelize.transaction(async (transaction) => {
    const products = await Product.findAll({
      where: {
        id: { [Op.in]: productIds },
        store_id: store.id,
        status: PRODUCT_STATUS.ACTIVE,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const productById = new Map(products.map((p) => [p.id, p]));
    const lineItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = productById.get(item.productId);
      if (!product) {
        throwError(`Product ${item.productId} is not available`, 400);
      }
      if (item.quantity > product.stock) {
        throwError(
          `Insufficient stock for "${product.name}" (requested ${item.quantity}, available ${product.stock})`,
          409
        );
      }

      const unitPrice = roundMoney(product.price);
      const lineTotal = roundMoney(unitPrice * item.quantity);
      subtotal += lineTotal;

      lineItems.push({
        product_id: product.id,
        product_name: product.name,
        unit_price: unitPrice,
        quantity: item.quantity,
        line_total: lineTotal,
        product,
      });
    }

    subtotal = roundMoney(subtotal);
    const total = subtotal;

    const order = await Order.create(
      {
        store_id: store.id,
        order_number: generateOrderNumber(store.id),
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_address: customer.address,
        note: note ?? null,
        status: ORDER_STATUSES.PENDING,
        payment_method: PAYMENT_METHODS.COD,
        payment_status: PAYMENT_STATUSES.UNPAID,
        subtotal,
        total,
      },
      { transaction }
    );

    await OrderItem.bulkCreate(
      lineItems.map((line) => ({
        order_id: order.id,
        product_id: line.product_id,
        product_name: line.product_name,
        unit_price: line.unit_price,
        quantity: line.quantity,
        line_total: line.line_total,
      })),
      { transaction }
    );

    for (const line of lineItems) {
      await line.product.decrement("stock", {
        by: line.quantity,
        transaction,
      });
    }

    const created = await Order.findByPk(order.id, {
      include: orderIncludes,
      transaction,
    });

    return formatOrder(created);
  });
};

const listStoreOrders = async (userId, query) => {
  const store = await getOwnerStore(userId);
  const page = Number(query.page) || 1;
  const pageSize = Math.min(Number(query.pageSize) || 10, 50);
  const offset = (page - 1) * pageSize;

  const where = { store_id: store.id };
  if (query.status) {
    where.status = query.status;
  }

  const { rows, count } = await Order.findAndCountAll({
    where,
    include: orderIncludes,
    order: [["created_at", "DESC"]],
    limit: pageSize,
    offset,
  });

  return {
    data: rows.map(formatOrder),
    total: count,
    page,
    pageSize,
  };
};

const getStoreOrderById = async (userId, orderId) => {
  const store = await getOwnerStore(userId);
  const order = await Order.findOne({
    where: { id: orderId, store_id: store.id },
    include: orderIncludes,
  });

  if (!order) {
    throwError("Order not found", 404);
  }

  return formatOrder(order);
};

const getOwnerOrder = async (userId, orderId, transaction) => {
  const store = await getOwnerStore(userId);
  const order = await Order.findOne({
    where: { id: orderId, store_id: store.id },
    transaction,
    lock: transaction?.LOCK.UPDATE,
  });

  if (!order) {
    throwError("Order not found", 404);
  }

  // Load lines separately — PostgreSQL rejects FOR UPDATE with LEFT OUTER JOIN includes.
  const orderItems = await OrderItem.findAll({
    where: { order_id: order.id },
    transaction,
  });
  order.setDataValue("OrderItems", orderItems);
  order.OrderItems = orderItems;

  return { store, order, orderItems };
};

const updateOrderStatus = async (userId, orderId, status) => {
  return sequelize.transaction(async (transaction) => {
    const { order, orderItems } = await getOwnerOrder(userId, orderId, transaction);

    if (order.status === status) {
      return formatOrder(
        await Order.findByPk(order.id, { include: orderIncludes, transaction })
      );
    }

    if (status === ORDER_STATUSES.CANCELLED) {
      if (!CANCELLABLE_STATUSES.has(order.status)) {
        throwError(
          "Only pending or confirmed orders can be cancelled",
          400
        );
      }

      await restoreOrderStock(orderItems, transaction);
      await order.update({ status: ORDER_STATUSES.CANCELLED }, { transaction });
    } else {
      const allowedTransitions = {
        [ORDER_STATUSES.PENDING]: new Set([
          ORDER_STATUSES.CONFIRMED,
          ORDER_STATUSES.CANCELLED,
        ]),
        [ORDER_STATUSES.CONFIRMED]: new Set([
          ORDER_STATUSES.SHIPPED,
          ORDER_STATUSES.CANCELLED,
        ]),
        [ORDER_STATUSES.SHIPPED]: new Set([ORDER_STATUSES.DELIVERED]),
      };

      const allowed = allowedTransitions[order.status];
      if (!allowed?.has(status)) {
        throwError(
          `Cannot change order status from "${order.status}" to "${status}"`,
          400
        );
      }

      await order.update({ status }, { transaction });
    }

    const updated = await Order.findByPk(order.id, {
      include: orderIncludes,
      transaction,
    });
    return formatOrder(updated);
  });
};

const createOrderReturn = async (userId, orderId, payload) => {
  return sequelize.transaction(async (transaction) => {
    const { store, order, orderItems } = await getOwnerOrder(
      userId,
      orderId,
      transaction
    );

    if (!RETURNABLE_ORDER_STATUSES.has(order.status)) {
      throwError("Returns are only allowed for delivered orders", 400);
    }

    const openReturn = await OrderReturn.findOne({
      where: {
        order_id: order.id,
        status: {
          [Op.in]: [RETURN_STATUSES.REQUESTED, RETURN_STATUSES.APPROVED],
        },
      },
      transaction,
    });

    if (openReturn) {
      throwError("This order already has an open return", 409);
    }

    const returnedQty = await getReturnedQuantities(order.id, transaction);
    const orderItemById = new Map(
      orderItems.map((item) => [item.id, item])
    );

    const returnLines = [];
    let refundAmount = 0;

    for (const line of payload.items) {
      const orderItem = orderItemById.get(line.orderItemId);
      if (!orderItem) {
        throwError(`Order line ${line.orderItemId} not found on this order`, 400);
      }

      const alreadyReturned = returnedQty.get(orderItem.id) ?? 0;
      const remaining = orderItem.quantity - alreadyReturned;

      if (line.quantityReturned > remaining) {
        throwError(
          `Cannot return ${line.quantityReturned} units of "${orderItem.product_name}" (${remaining} remaining)`,
          400
        );
      }

      const lineRefund = roundMoney(
        Number(orderItem.unit_price) * line.quantityReturned
      );
      refundAmount += lineRefund;

      returnLines.push({
        order_item_id: orderItem.id,
        quantity_returned: line.quantityReturned,
        restock: line.restock ?? true,
      });
    }

    const orderReturn = await OrderReturn.create(
      {
        order_id: order.id,
        store_id: store.id,
        status: RETURN_STATUSES.REQUESTED,
        reason: payload.reason ?? null,
        merchant_note: payload.merchantNote ?? null,
        refund_status: REFUND_STATUSES.NONE,
        refund_amount: roundMoney(refundAmount),
      },
      { transaction }
    );

    await OrderReturnItem.bulkCreate(
      returnLines.map((line) => ({
        return_id: orderReturn.id,
        ...line,
      })),
      { transaction }
    );

    const created = await OrderReturn.findByPk(orderReturn.id, {
      include: [
        {
          model: OrderReturnItem,
          attributes: ["id", "order_item_id", "quantity_returned", "restock"],
        },
      ],
      transaction,
    });

    return {
      ...created.get({ plain: true }),
      refund_amount: Number(created.refund_amount),
    };
  });
};

const updateReturnStatus = async (userId, returnId, payload) => {
  return sequelize.transaction(async (transaction) => {
    const store = await getOwnerStore(userId);

    const orderReturn = await OrderReturn.findOne({
      where: { id: returnId, store_id: store.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!orderReturn) {
      throwError("Return not found", 404);
    }

    const orderReturnItems = await OrderReturnItem.findAll({
      where: { return_id: orderReturn.id },
      transaction,
    });
    orderReturn.setDataValue("OrderReturnItems", orderReturnItems);
    orderReturn.OrderReturnItems = orderReturnItems;

    const order = await Order.findByPk(orderReturn.order_id, { transaction });
    if (!order) {
      throwError("Order not found for return", 404);
    }

    const orderItems = await OrderItem.findAll({
      where: { order_id: order.id },
      transaction,
    });
    order.setDataValue("OrderItems", orderItems);
    order.OrderItems = orderItems;
    orderReturn.setDataValue("Order", order);
    orderReturn.Order = order;

    const { status } = payload;
    const current = orderReturn.status;

    if (current === status) {
      return orderReturn.get({ plain: true });
    }

    if (status === RETURN_STATUSES.APPROVED) {
      if (current !== RETURN_STATUSES.REQUESTED) {
        throwError("Only requested returns can be approved", 400);
      }
      await orderReturn.update(
        {
          status: RETURN_STATUSES.APPROVED,
          merchant_note: payload.merchantNote ?? orderReturn.merchant_note,
        },
        { transaction }
      );
    } else if (status === RETURN_STATUSES.REJECTED) {
      if (current !== RETURN_STATUSES.REQUESTED) {
        throwError("Only requested returns can be rejected", 400);
      }
      await orderReturn.update(
        {
          status: RETURN_STATUSES.REJECTED,
          merchant_note: payload.merchantNote ?? orderReturn.merchant_note,
        },
        { transaction }
      );
    } else if (status === RETURN_STATUSES.COMPLETED) {
      if (current !== RETURN_STATUSES.APPROVED) {
        throwError("Only approved returns can be completed", 400);
      }

      for (const line of orderReturn.OrderReturnItems) {
        if (!line.restock) continue;

        const orderItem = orderReturn.Order.OrderItems.find(
          (item) => item.id === line.order_item_id
        );
        if (!orderItem) continue;

        await Product.increment("stock", {
          by: line.quantity_returned,
          where: { id: orderItem.product_id },
          transaction,
        });
      }

      const refundStatus = payload.refundStatus ?? REFUND_STATUSES.PENDING;
      await orderReturn.update(
        {
          status: RETURN_STATUSES.COMPLETED,
          refund_status: refundStatus,
          refund_amount:
            payload.refundAmount != null
              ? roundMoney(payload.refundAmount)
              : orderReturn.refund_amount,
          merchant_note: payload.merchantNote ?? orderReturn.merchant_note,
        },
        { transaction }
      );

      const returnedQty = await getReturnedQuantities(
        orderReturn.order_id,
        transaction
      );

      const allFullyReturned = orderReturn.Order.OrderItems.every((item) => {
        const returned = returnedQty.get(item.id) ?? 0;
        return returned >= item.quantity;
      });

      const anyReturned = orderReturn.Order.OrderItems.some((item) => {
        const returned = returnedQty.get(item.id) ?? 0;
        return returned > 0;
      });

      let orderStatus = orderReturn.Order.status;
      if (allFullyReturned) {
        orderStatus = ORDER_STATUSES.RETURNED;
      } else if (anyReturned) {
        orderStatus = ORDER_STATUSES.PARTIALLY_RETURNED;
      }

      const orderUpdates = { status: orderStatus };

      if (refundStatus === REFUND_STATUSES.REFUNDED) {
        const totalRefunded = await sumCompletedRefunds(
          orderReturn.order_id,
          transaction
        );
        const nextPaymentStatus = resolvePaymentStatusAfterRefund(
          Number(orderReturn.Order.total),
          totalRefunded
        );
        if (nextPaymentStatus) {
          orderUpdates.payment_status = nextPaymentStatus;
        }
      }

      await orderReturn.Order.update(orderUpdates, { transaction });
    } else {
      throwError(`Invalid return status: ${status}`, 400);
    }

    const updated = await OrderReturn.findByPk(orderReturn.id, {
      include: [
        {
          model: OrderReturnItem,
          attributes: ["id", "order_item_id", "quantity_returned", "restock"],
        },
      ],
      transaction,
    });

    const plain = updated.get({ plain: true });
    return {
      ...plain,
      refund_amount:
        plain.refund_amount != null ? Number(plain.refund_amount) : null,
    };
  });
};

const listOrderReturns = async (userId, orderId) => {
  const store = await getOwnerStore(userId);
  const order = await Order.findOne({
    where: { id: orderId, store_id: store.id },
  });

  if (!order) {
    throwError("Order not found", 404);
  }

  const returns = await OrderReturn.findAll({
    where: { order_id: orderId, store_id: store.id },
    include: [
      {
        model: OrderReturnItem,
        attributes: ["id", "order_item_id", "quantity_returned", "restock"],
      },
    ],
    order: [["created_at", "DESC"]],
  });

  return returns.map((ret) => {
    const plain = ret.get({ plain: true });
    return {
      ...plain,
      refund_amount:
        plain.refund_amount != null ? Number(plain.refund_amount) : null,
    };
  });
};

export {
  createStoreOrder,
  listStoreOrders,
  getStoreOrderById,
  updateOrderStatus,
  createOrderReturn,
  updateReturnStatus,
  listOrderReturns,
};
