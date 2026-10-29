const ORDER_STATUSES = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  PARTIALLY_RETURNED: "partially_returned",
  RETURNED: "returned",
};

const CANCELLABLE_STATUSES = new Set([
  ORDER_STATUSES.PENDING,
  ORDER_STATUSES.CONFIRMED,
]);

const RETURNABLE_ORDER_STATUSES = new Set([
  ORDER_STATUSES.DELIVERED,
  ORDER_STATUSES.PARTIALLY_RETURNED,
]);

const RETURN_STATUSES = {
  REQUESTED: "requested",
  APPROVED: "approved",
  REJECTED: "rejected",
  COMPLETED: "completed",
};

const REFUND_STATUSES = {
  NONE: "none",
  PENDING: "pending",
  REFUNDED: "refunded",
};

const PAYMENT_METHODS = {
  COD: "cod",
};

const PAYMENT_STATUSES = {
  UNPAID: "unpaid",
  PAID: "paid",
  PARTIALLY_REFUNDED: "partially_refunded",
  REFUNDED: "refunded",
};

const MAX_ORDER_LINES = 20;
const MAX_LINE_QUANTITY = 99;

export {
  ORDER_STATUSES,
  CANCELLABLE_STATUSES,
  RETURNABLE_ORDER_STATUSES,
  RETURN_STATUSES,
  REFUND_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  MAX_ORDER_LINES,
  MAX_LINE_QUANTITY,
};
