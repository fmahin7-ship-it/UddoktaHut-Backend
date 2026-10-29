import { and, eq, inArray, sql } from "drizzle-orm";
import { assertFound, throwError } from "../../lib/throwError.ts";
import {
  CANCELLABLE_STATUSES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  REFUND_STATUSES,
  RETURN_STATUSES,
  RETURNABLE_ORDER_STATUSES,
} from "../../constants/orderConstants.ts";
import { db } from "../../db/client.ts";
import {
  orderItems,
  orderReturnItems,
  orderReturns,
  orders,
  products,
  stores,
} from "../../db/schema/index.ts";
import { PRODUCT_STATUS } from "../../constants/productConstants.ts";
import type { Database } from "../../db/client.ts";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const roundMoney = (value: number | string) =>
  Math.round(Number(value) * 100) / 100;

const generateOrderNumber = (storeId: number) => {
  const ts = Date.now().toString(36).toUpperCase();
  return `ORD-${storeId}-${ts}`;
};

const getOwnerStore = async (userId: number) => {
  const store = await db.query.stores.findFirst({
    where: eq(stores.user_id, userId),
  });
  if (!store) {
    throwError("Store not found for authenticated user", 403);
  }
  return store!;
};

const getStoreByName = async (storeName: string) => {
  const store = await db.query.stores.findFirst({
    where: eq(stores.store_name, storeName),
  });
  if (!store) {
    throwError("Store not found", 404);
  }
  return store!;
};

const loadOrderGraph = async (orderId: number, tx: Tx | typeof db = db) =>
  tx.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      items: {
        columns: {
          id: true,
          product_id: true,
          product_name: true,
          unit_price: true,
          quantity: true,
          line_total: true,
        },
      },
      returns: {
        columns: {
          id: true,
          status: true,
          reason: true,
          merchant_note: true,
          refund_status: true,
          refund_amount: true,
          created_at: true,
        },
        with: {
          items: {
            columns: {
              id: true,
              order_item_id: true,
              quantity_returned: true,
              restock: true,
            },
          },
        },
      },
    },
  });

const formatOrder = (
  order: NonNullable<Awaited<ReturnType<typeof loadOrderGraph>>>
) => {
  const orderReturnsMapped = order.returns?.map((ret) => ({
    ...ret,
    refund_amount:
      ret.refund_amount != null ? Number(ret.refund_amount) : null,
    OrderReturnItems: ret.items,
  }));

  const totalRefunded = roundMoney(
    (orderReturnsMapped || [])
      .filter(
        (ret) =>
          ret.status === RETURN_STATUSES.COMPLETED &&
          ret.refund_status === REFUND_STATUSES.REFUNDED
      )
      .reduce((sum, ret) => sum + Number(ret.refund_amount || 0), 0)
  );
  const orderTotal = Number(order.total);

  return {
    ...order,
    subtotal: Number(order.subtotal),
    total: orderTotal,
    total_refunded: totalRefunded,
    net_total: roundMoney(Math.max(0, orderTotal - totalRefunded)),
    OrderItems: order.items?.map((item) => ({
      ...item,
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total),
    })),
    OrderReturns: orderReturnsMapped,
  };
};

const sumCompletedRefunds = async (orderId: number, tx: Tx) => {
  const returns = await tx
    .select({ refund_amount: orderReturns.refund_amount })
    .from(orderReturns)
    .where(
      and(
        eq(orderReturns.order_id, orderId),
        eq(orderReturns.status, RETURN_STATUSES.COMPLETED),
        eq(orderReturns.refund_status, REFUND_STATUSES.REFUNDED)
      )
    );

  return roundMoney(
    returns.reduce((sum, ret) => sum + Number(ret.refund_amount || 0), 0)
  );
};

const resolvePaymentStatusAfterRefund = (
  orderTotal: number,
  totalRefunded: number
) => {
  if (totalRefunded <= 0) {
    return null;
  }
  if (totalRefunded >= orderTotal) {
    return PAYMENT_STATUSES.REFUNDED;
  }
  return PAYMENT_STATUSES.PARTIALLY_REFUNDED;
};

const getReturnedQuantities = async (orderId: number, tx: Tx) => {
  const rows = await tx
    .select({
      order_item_id: orderReturnItems.order_item_id,
      quantity_returned: orderReturnItems.quantity_returned,
    })
    .from(orderReturnItems)
    .innerJoin(orderReturns, eq(orderReturnItems.return_id, orderReturns.id))
    .where(
      and(
        eq(orderReturns.order_id, orderId),
        eq(orderReturns.status, RETURN_STATUSES.COMPLETED)
      )
    );

  const map = new Map<number, number>();
  for (const row of rows) {
    const current = map.get(row.order_item_id) ?? 0;
    map.set(row.order_item_id, current + row.quantity_returned);
  }
  return map;
};

const restoreOrderStock = async (
  items: Array<{ product_id: number; quantity: number }>,
  tx: Tx
) => {
  for (const item of items) {
    await tx
      .update(products)
      .set({ stock: sql`${products.stock} + ${item.quantity}` })
      .where(eq(products.id, item.product_id));
  }
};

const createStoreOrder = async (
  storeName: string,
  payload: {
    customer: { name: string; phone: string; address: string };
    items: Array<{ productId: number; quantity: number }>;
    paymentMethod?: string;
    note?: string;
  }
) => {
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

  return db.transaction(async (tx) => {
    const lockedProducts = await tx
      .select()
      .from(products)
      .where(
        and(
          inArray(products.id, productIds),
          eq(products.store_id, store.id),
          eq(products.status, PRODUCT_STATUS.ACTIVE)
        )
      )
      .for("update");

    const productById = new Map(lockedProducts.map((p) => [p.id, p]));
    const lineItems: Array<{
      product_id: number;
      product_name: string;
      unit_price: number;
      quantity: number;
      line_total: number;
      product: (typeof lockedProducts)[number];
    }> = [];
    let subtotal = 0;

    for (const item of items) {
      const product = productById.get(item.productId);
      if (!product) {
        throwError(`Product ${item.productId} is not available`, 400);
      }
      if (item.quantity > product!.stock) {
        throwError(
          `Insufficient stock for "${product!.name}" (requested ${item.quantity}, available ${product!.stock})`,
          409
        );
      }

      const unitPrice = roundMoney(product!.price);
      const lineTotal = roundMoney(unitPrice * item.quantity);
      subtotal += lineTotal;

      lineItems.push({
        product_id: product!.id,
        product_name: product!.name,
        unit_price: unitPrice,
        quantity: item.quantity,
        line_total: lineTotal,
        product: product!,
      });
    }

    subtotal = roundMoney(subtotal);
    const total = subtotal;

    const [order] = await tx
      .insert(orders)
      .values({
        store_id: store.id,
        order_number: generateOrderNumber(store.id),
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_address: customer.address,
        note: note ?? null,
        status: ORDER_STATUSES.PENDING,
        payment_method: PAYMENT_METHODS.COD,
        payment_status: PAYMENT_STATUSES.UNPAID,
        subtotal: String(subtotal),
        total: String(total),
      })
      .returning();

    assertFound(order, "Could not create order", 500);

    await tx.insert(orderItems).values(
      lineItems.map((line) => ({
        order_id: order.id,
        product_id: line.product_id,
        product_name: line.product_name,
        unit_price: String(line.unit_price),
        quantity: line.quantity,
        line_total: String(line.line_total),
      }))
    );

    for (const line of lineItems) {
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${line.quantity}` })
        .where(eq(products.id, line.product_id));
    }

    const created = await loadOrderGraph(order.id, tx);
    return formatOrder(created!);
  });
};

const listStoreOrders = async (
  userId: number,
  query: { page?: string; pageSize?: string; status?: string }
) => {
  const store = await getOwnerStore(userId);
  const page = Number(query.page) || 1;
  const pageSize = Math.min(Number(query.pageSize) || 10, 50);
  const offset = (page - 1) * pageSize;

  const listWhere = query.status
    ? and(eq(orders.store_id, store.id), eq(orders.status, query.status))
    : eq(orders.store_id, store.id);

  const rows = await db.query.orders.findMany({
    where: (table, { and: andFn, eq: eqFn }) => {
      const parts = [eqFn(table.store_id, store.id)];
      if (query.status) parts.push(eqFn(table.status, query.status));
      return andFn(...parts);
    },
    with: {
      items: {
        columns: {
          id: true,
          product_id: true,
          product_name: true,
          unit_price: true,
          quantity: true,
          line_total: true,
        },
      },
      returns: {
        columns: {
          id: true,
          status: true,
          reason: true,
          merchant_note: true,
          refund_status: true,
          refund_amount: true,
          created_at: true,
        },
        with: {
          items: {
            columns: {
              id: true,
              order_item_id: true,
              quantity_returned: true,
              restock: true,
            },
          },
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.created_at)],
    limit: pageSize,
    offset,
  });

  const counted = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(listWhere);

  return {
    data: rows.map((row) => formatOrder(row)),
    total: counted[0]?.count ?? 0,
    page,
    pageSize,
  };
};

const getStoreOrderById = async (userId: number, orderId: number) => {
  const store = await getOwnerStore(userId);
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.store_id, store.id)),
    with: {
      items: {
        columns: {
          id: true,
          product_id: true,
          product_name: true,
          unit_price: true,
          quantity: true,
          line_total: true,
        },
      },
      returns: {
        columns: {
          id: true,
          status: true,
          reason: true,
          merchant_note: true,
          refund_status: true,
          refund_amount: true,
          created_at: true,
        },
        with: {
          items: {
            columns: {
              id: true,
              order_item_id: true,
              quantity_returned: true,
              restock: true,
            },
          },
        },
      },
    },
  });

  assertFound(order, "Order not found", 404);

  return formatOrder(order);
};

const getOwnerOrder = async (userId: number, orderId: number, tx: Tx) => {
  const store = await getOwnerStore(userId);
  const [order] = await tx
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.store_id, store.id)))
    .for("update");

  assertFound(order, "Order not found", 404);

  const orderItemsRows = await tx
    .select()
    .from(orderItems)
    .where(eq(orderItems.order_id, order.id));

  return { store, order, orderItems: orderItemsRows };
};

const updateOrderStatus = async (
  userId: number,
  orderId: number,
  status: string
) =>
  db.transaction(async (tx) => {
    const { order, orderItems: orderItemsRows } = await getOwnerOrder(
      userId,
      orderId,
      tx
    );

    if (order.status === status) {
      const current = await loadOrderGraph(order.id, tx);
      return formatOrder(current!);
    }

    if (status === ORDER_STATUSES.CANCELLED) {
      if (!CANCELLABLE_STATUSES.has(order.status)) {
        throwError("Only pending or confirmed orders can be cancelled", 400);
      }

      await restoreOrderStock(orderItemsRows, tx);
      await tx
        .update(orders)
        .set({ status: ORDER_STATUSES.CANCELLED })
        .where(eq(orders.id, order.id));
    } else {
      const allowedTransitions: Record<string, Set<string>> = {
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

      await tx.update(orders).set({ status }).where(eq(orders.id, order.id));
    }

    const updated = await loadOrderGraph(order.id, tx);
    return formatOrder(updated!);
  });

const createOrderReturn = async (
  userId: number,
  orderId: number,
  payload: {
    items: Array<{
      orderItemId: number;
      quantityReturned: number;
      restock?: boolean;
    }>;
    reason?: string;
    merchantNote?: string;
  }
) =>
  db.transaction(async (tx) => {
    const { store, order, orderItems: orderItemsRows } = await getOwnerOrder(
      userId,
      orderId,
      tx
    );

    if (!RETURNABLE_ORDER_STATUSES.has(order.status)) {
      throwError("Returns are only allowed for delivered orders", 400);
    }

    const openReturn = await tx.query.orderReturns.findFirst({
      where: and(
        eq(orderReturns.order_id, order.id),
        inArray(orderReturns.status, [
          RETURN_STATUSES.REQUESTED,
          RETURN_STATUSES.APPROVED,
        ])
      ),
    });

    if (openReturn) {
      throwError("This order already has an open return", 409);
    }

    const returnedQty = await getReturnedQuantities(order.id, tx);
    const orderItemById = new Map(orderItemsRows.map((item) => [item.id, item]));

    const returnLines: Array<{
      order_item_id: number;
      quantity_returned: number;
      restock: boolean;
    }> = [];
    let refundAmount = 0;

    for (const line of payload.items) {
      const orderItem = orderItemById.get(line.orderItemId);
      if (!orderItem) {
        throwError(`Order line ${line.orderItemId} not found on this order`, 400);
      }

      const alreadyReturned = returnedQty.get(orderItem!.id) ?? 0;
      const remaining = orderItem!.quantity - alreadyReturned;

      if (line.quantityReturned > remaining) {
        throwError(
          `Cannot return ${line.quantityReturned} units of "${orderItem!.product_name}" (${remaining} remaining)`,
          400
        );
      }

      const lineRefund = roundMoney(
        Number(orderItem!.unit_price) * line.quantityReturned
      );
      refundAmount += lineRefund;

      returnLines.push({
        order_item_id: orderItem!.id,
        quantity_returned: line.quantityReturned,
        restock: line.restock ?? true,
      });
    }

    const [orderReturn] = await tx
      .insert(orderReturns)
      .values({
        order_id: order.id,
        store_id: store.id,
        status: RETURN_STATUSES.REQUESTED,
        reason: payload.reason ?? null,
        merchant_note: payload.merchantNote ?? null,
        refund_status: REFUND_STATUSES.NONE,
        refund_amount: String(roundMoney(refundAmount)),
      })
      .returning();

    assertFound(orderReturn, "Could not create return", 500);

    await tx.insert(orderReturnItems).values(
      returnLines.map((line) => ({
        return_id: orderReturn.id,
        ...line,
      }))
    );

    const created = await tx.query.orderReturns.findFirst({
      where: eq(orderReturns.id, orderReturn.id),
      with: {
        items: {
          columns: {
            id: true,
            order_item_id: true,
            quantity_returned: true,
            restock: true,
          },
        },
      },
    });

    return {
      ...created,
      refund_amount: Number(created!.refund_amount),
    };
  });

const updateReturnStatus = async (
  userId: number,
  returnId: number,
  payload: {
    status: string;
    merchantNote?: string;
    refundStatus?: string;
    refundAmount?: number;
  }
) =>
  db.transaction(async (tx) => {
    const store = await getOwnerStore(userId);

    const [orderReturn] = await tx
      .select()
      .from(orderReturns)
      .where(and(eq(orderReturns.id, returnId), eq(orderReturns.store_id, store.id)))
      .for("update");

    assertFound(orderReturn, "Return not found", 404);

    const orderReturnItemsRows = await tx
      .select()
      .from(orderReturnItems)
      .where(eq(orderReturnItems.return_id, orderReturn.id));

    const order = await tx.query.orders.findFirst({
      where: eq(orders.id, orderReturn.order_id),
    });
    assertFound(order, "Order not found for return", 404);

    const orderItemsRows = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.order_id, order!.id));

    const { status } = payload;
    const current = orderReturn.status;

    if (current === status) {
      return { ...orderReturn, OrderReturnItems: orderReturnItemsRows };
    }

    if (status === RETURN_STATUSES.APPROVED) {
      if (current !== RETURN_STATUSES.REQUESTED) {
        throwError("Only requested returns can be approved", 400);
      }
      await tx
        .update(orderReturns)
        .set({
          status: RETURN_STATUSES.APPROVED,
          merchant_note: payload.merchantNote ?? orderReturn.merchant_note,
        })
        .where(eq(orderReturns.id, orderReturn.id));
    } else if (status === RETURN_STATUSES.REJECTED) {
      if (current !== RETURN_STATUSES.REQUESTED) {
        throwError("Only requested returns can be rejected", 400);
      }
      await tx
        .update(orderReturns)
        .set({
          status: RETURN_STATUSES.REJECTED,
          merchant_note: payload.merchantNote ?? orderReturn.merchant_note,
        })
        .where(eq(orderReturns.id, orderReturn.id));
    } else if (status === RETURN_STATUSES.COMPLETED) {
      if (current !== RETURN_STATUSES.APPROVED) {
        throwError("Only approved returns can be completed", 400);
      }

      for (const line of orderReturnItemsRows) {
        if (!line.restock) continue;

        const orderItem = orderItemsRows.find(
          (item) => item.id === line.order_item_id
        );
        if (!orderItem) continue;

        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} + ${line.quantity_returned}`,
          })
          .where(eq(products.id, orderItem.product_id));
      }

      const refundStatus = payload.refundStatus ?? REFUND_STATUSES.PENDING;
      await tx
        .update(orderReturns)
        .set({
          status: RETURN_STATUSES.COMPLETED,
          refund_status: refundStatus,
          refund_amount:
            payload.refundAmount != null
              ? String(roundMoney(payload.refundAmount))
              : orderReturn.refund_amount,
          merchant_note: payload.merchantNote ?? orderReturn.merchant_note,
        })
        .where(eq(orderReturns.id, orderReturn.id));

      const returnedQty = await getReturnedQuantities(
        orderReturn.order_id,
        tx
      );

      const allFullyReturned = orderItemsRows.every((item) => {
        const returned = returnedQty.get(item.id) ?? 0;
        return returned >= item.quantity;
      });

      const anyReturned = orderItemsRows.some((item) => {
        const returned = returnedQty.get(item.id) ?? 0;
        return returned > 0;
      });

      let orderStatus = order!.status;
      if (allFullyReturned) {
        orderStatus = ORDER_STATUSES.RETURNED;
      } else if (anyReturned) {
        orderStatus = ORDER_STATUSES.PARTIALLY_RETURNED;
      }

      const orderUpdates: {
        status: string;
        payment_status?: string;
      } = { status: orderStatus };

      if (refundStatus === REFUND_STATUSES.REFUNDED) {
        const totalRefunded = await sumCompletedRefunds(
          orderReturn.order_id,
          tx
        );
        const nextPaymentStatus = resolvePaymentStatusAfterRefund(
          Number(order!.total),
          totalRefunded
        );
        if (nextPaymentStatus) {
          orderUpdates.payment_status = nextPaymentStatus;
        }
      }

      await tx
        .update(orders)
        .set(orderUpdates)
        .where(eq(orders.id, order!.id));
    } else {
      throwError(`Invalid return status: ${status}`, 400);
    }

    const updated = await tx.query.orderReturns.findFirst({
      where: eq(orderReturns.id, orderReturn.id),
      with: {
        items: {
          columns: {
            id: true,
            order_item_id: true,
            quantity_returned: true,
            restock: true,
          },
        },
      },
    });

    return {
      ...updated,
      refund_amount:
        updated?.refund_amount != null
          ? Number(updated.refund_amount)
          : null,
    };
  });

const listOrderReturns = async (userId: number, orderId: number) => {
  const store = await getOwnerStore(userId);
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.store_id, store.id)),
  });

  assertFound(order, "Order not found", 404);

  const returns = await db.query.orderReturns.findMany({
    where: and(eq(orderReturns.order_id, orderId), eq(orderReturns.store_id, store.id)),
    with: {
      items: {
        columns: {
          id: true,
          order_item_id: true,
          quantity_returned: true,
          restock: true,
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.created_at)],
  });

  return returns.map((ret) => ({
    ...ret,
    refund_amount:
      ret.refund_amount != null ? Number(ret.refund_amount) : null,
  }));
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
