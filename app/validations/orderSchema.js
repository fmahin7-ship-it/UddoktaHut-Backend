import { z } from "zod";
import {
  MAX_LINE_QUANTITY,
  MAX_ORDER_LINES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  REFUND_STATUSES,
  RETURN_STATUSES,
} from "../constants/orderConstants.js";
const bdPhoneSchema = z
  .string()
  .trim()
  .regex(/^01[0-9]{9}$/, "Phone must be a valid 11-digit Bangladesh number");

const createOrderItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(MAX_LINE_QUANTITY),
});

export const createOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1).max(255),
    phone: bdPhoneSchema,
    address: z.string().trim().min(5).max(2000),
  }),
  items: z
    .array(createOrderItemSchema)
    .min(1)
    .max(MAX_ORDER_LINES),
  paymentMethod: z.enum([PAYMENT_METHODS.COD]).optional().default(PAYMENT_METHODS.COD),
  note: z.string().trim().max(1000).optional(),
});

export const orderIdParamSchema = z.object({
  id: z.string().regex(/^[0-9]+$/, "Order ID must be a number"),
});

export const returnIdParamSchema = z.object({
  returnId: z.string().regex(/^[0-9]+$/, "Return ID must be a number"),
});

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(50).optional(),
  status: z
    .enum([
      ORDER_STATUSES.PENDING,
      ORDER_STATUSES.CONFIRMED,
      ORDER_STATUSES.SHIPPED,
      ORDER_STATUSES.DELIVERED,
      ORDER_STATUSES.CANCELLED,
      ORDER_STATUSES.PARTIALLY_RETURNED,
      ORDER_STATUSES.RETURNED,
    ])
    .optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    ORDER_STATUSES.CONFIRMED,
    ORDER_STATUSES.SHIPPED,
    ORDER_STATUSES.DELIVERED,
    ORDER_STATUSES.CANCELLED,
  ]),
});

const createReturnItemSchema = z.object({
  orderItemId: z.coerce.number().int().positive(),
  quantityReturned: z.coerce.number().int().min(1).max(MAX_LINE_QUANTITY),
  restock: z.boolean().optional().default(true),
});

export const createOrderReturnSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
  merchantNote: z.string().trim().max(2000).optional(),
  items: z.array(createReturnItemSchema).min(1).max(MAX_ORDER_LINES),
});

export const updateReturnStatusSchema = z.object({
  status: z.enum([
    RETURN_STATUSES.APPROVED,
    RETURN_STATUSES.REJECTED,
    RETURN_STATUSES.COMPLETED,
  ]),
  merchantNote: z.string().trim().max(2000).optional(),
  refundStatus: z
    .enum([
      REFUND_STATUSES.NONE,
      REFUND_STATUSES.PENDING,
      REFUND_STATUSES.REFUNDED,
    ])
    .optional(),
  refundAmount: z.number().nonnegative().optional(),
});
