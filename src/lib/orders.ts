import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { dhakaTodayRange } from "@/lib/utils";
import type { OrderSettings } from "@/lib/order-settings";

// ---------------------------------------------------------------------------
// Order status machine
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "ready",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  ready: "Ready for Pickup",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Admin-allowed status transitions. Delivered and cancelled are terminal. */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["ready", "shipped", "cancelled"],
  ready: ["shipped", "delivered", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

/** Statuses from which a customer may cancel their own order directly. */
export const CUSTOMER_CANCELLABLE_FROM = ["pending"] as const;

export const PAYMENT_METHODS = [
  "cod",
  "cash_at_shop",
  "bkash",
  "nagad",
  "rocket",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
  cash_at_shop: "Cash at Shop",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  pending_verification: "Pending Verification",
  partially_paid: "Partially Paid",
  paid: "Paid",
  refunded: "Refunded",
  partially_refunded: "Partially Refunded",
};

/** Payment methods that require the customer to submit a transaction ID. */
export const MOBILE_BANKING_METHODS = ["bkash", "nagad", "rocket"] as const;

export const ORDER_INCLUDE = {
  items: { orderBy: { createdAt: "asc" as const } },
  payments: { orderBy: { createdAt: "desc" as const } },
  history: { orderBy: { createdAt: "asc" as const } },
  customer: { select: { id: true, name: true, phone: true, email: true } },
} satisfies Prisma.OrderInclude;

// ---------------------------------------------------------------------------
// Order numbers: KGP-YYYYMMDD-SEQUENCE (sequence restarts each Dhaka day)
// ---------------------------------------------------------------------------

export async function generateOrderNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const { start, end } = dhakaTodayRange();
  const count = await tx.order.count({
    where: { createdAt: { gte: start, lte: end } },
  });
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) =>
    parts.find((p) => p.type === t)?.value ?? "";
  const yyyymmdd = `${get("year")}${get("month")}${get("day")}`;
  return `KGP-${yyyymmdd}-${String(count + 1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Pricing — always computed server-side from database prices. Never trust
// client-supplied prices, quantities, discounts or totals.
// ---------------------------------------------------------------------------

export function effectiveUnitPrice(product: {
  price: unknown;
  discountPrice?: unknown | null;
}): number {
  const price = Number(product.price);
  const discount =
    product.discountPrice === null || product.discountPrice === undefined
      ? null
      : Number(product.discountPrice);
  if (discount !== null && !Number.isNaN(discount) && discount > 0 && discount < price) {
    return discount;
  }
  return price;
}

export type CartLineInput = { productId: string; quantity: number };

export type ValidatedLine = {
  productId: string;
  name: string;
  image: string | null;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  discount: number;
  total: number;
};

/**
 * Validate cart lines against the live database: product must exist, be
 * orderable (status "available") and have enough stock. Returns the
 * server-computed lines and totals. Throws on the first problem.
 */
export async function validateCartItems(
  tx: Prisma.TransactionClient,
  items: CartLineInput[],
): Promise<{ lines: ValidatedLine[]; subtotal: number; discount: number }> {
  if (items.length === 0) {
    throw new Error("Your cart is empty.");
  }
  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: ids } },
    include: { images: { orderBy: { order: "asc" }, take: 1 } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: ValidatedLine[] = [];
  for (const item of items) {
    const qty = Math.floor(item.quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      throw new Error("Invalid quantity in cart.");
    }
    const product = byId.get(item.productId);
    if (!product) {
      throw new Error("A product in your cart is no longer available.");
    }
    if (product.status !== "available") {
      throw new Error(`"${product.name}" is not available for ordering right now.`);
    }
    if (product.stock < qty) {
      throw new Error(
        `Only ${product.stock} of "${product.name}" left in stock.`,
      );
    }
    const unitPrice = effectiveUnitPrice(product);
    const original = Number(product.price);
    const discount = Math.max(0, original - unitPrice) * qty;
    lines.push({
      productId: product.id,
      name: product.name,
      image: product.images[0]?.url ?? null,
      sku: product.sku,
      unitPrice,
      quantity: qty,
      discount,
      total: unitPrice * qty,
    });
  }
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const discount = lines.reduce((s, l) => s + l.discount, 0);
  return { lines, subtotal, discount };
}

/** Delivery fee from settings — never hardcoded. Pickup is always free. */
export function calculateDeliveryFee(
  subtotal: number,
  deliveryMethod: string,
  area: string | undefined | null,
  district: string | undefined | null,
  settings: OrderSettings,
): number {
  if (deliveryMethod === "pickup") return 0;
  if (
    settings.freeDeliveryThreshold > 0 &&
    subtotal >= settings.freeDeliveryThreshold
  ) {
    return 0;
  }
  const haystacks = [area, district]
    .filter(Boolean)
    .map((s) => s!.trim().toLowerCase());
  for (const rule of settings.deliveryAreas) {
    const needle = rule.area.trim().toLowerCase();
    if (haystacks.some((h) => h === needle || h.includes(needle) || needle.includes(h))) {
      return rule.fee;
    }
  }
  return settings.defaultDeliveryFee;
}

// ---------------------------------------------------------------------------
// Order history + notifications
// ---------------------------------------------------------------------------

export async function addOrderHistory(
  tx: Prisma.TransactionClient,
  orderId: string,
  fromStatus: string | null,
  toStatus: string,
  changedBy: "customer" | "admin" | "system",
  changedById?: string | null,
  note?: string | null,
): Promise<void> {
  await tx.orderStatusHistory.create({
    data: {
      orderId,
      fromStatus,
      toStatus,
      changedBy,
      changedById: changedById ?? null,
      note: note ?? null,
    },
  });
}

const NOTIFICATION_TEXT: Record<string, { title: string; message: string }> = {
  order_placed: {
    title: "Order placed",
    message: "Your order has been received successfully.",
  },
  order_confirmed: {
    title: "Order confirmed",
    message: "Your order has been confirmed by Kazi Gift and Print House.",
  },
  order_processing: {
    title: "Order processing",
    message: "Your order is currently being prepared.",
  },
  order_ready: {
    title: "Ready for pickup",
    message: "Your order is ready for collection.",
  },
  order_shipped: {
    title: "Order shipped",
    message: "Your order has been dispatched.",
  },
  order_delivered: {
    title: "Order delivered",
    message: "Your order has been delivered successfully.",
  },
  order_cancelled: {
    title: "Order cancelled",
    message: "Your order has been cancelled.",
  },
  payment_verified: {
    title: "Payment verified",
    message: "Your payment has been verified. Thank you!",
  },
};

export async function createNotification(
  tx: Prisma.TransactionClient,
  orderId: string,
  customerId: string | null,
  type: string,
): Promise<void> {
  if (!customerId) return; // guest orders have no in-app inbox
  const text = NOTIFICATION_TEXT[type] ?? {
    title: "Order update",
    message: "There is an update on your order.",
  };
  await tx.notification.create({
    data: {
      customerId,
      orderId,
      type,
      title: text.title,
      message: text.message,
    },
  });
}

// ---------------------------------------------------------------------------
// Inventory — deduct only on admin confirm, restore only on cancel.
// The order.stockDeducted flag makes both operations idempotent.
// ---------------------------------------------------------------------------

export async function deductStockForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || order.stockDeducted) return;
  for (const item of order.items) {
    if (!item.productId) continue;
    const product = await tx.product.findUnique({
      where: { id: item.productId },
    });
    if (!product) continue;
    if (product.stock < item.quantity) {
      throw new Error(
        `Not enough stock for "${item.name}" (${product.stock} left).`,
      );
    }
    const newStock = product.stock - item.quantity;
    await tx.product.update({
      where: { id: product.id },
      data: { stock: newStock },
    });
    await tx.stockMovement.create({
      data: {
        productId: product.id,
        orderId: order.id,
        type: "sale",
        quantity: -item.quantity,
        previousStock: product.stock,
        newStock,
        reason: `Order ${order.orderNumber} confirmed`,
      },
    });
  }
  await tx.order.update({
    where: { id: order.id },
    data: { stockDeducted: true },
  });
}

export async function restoreStockForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || !order.stockDeducted) return;
  for (const item of order.items) {
    if (!item.productId) continue;
    const product = await tx.product.findUnique({
      where: { id: item.productId },
    });
    if (!product) continue;
    const newStock = product.stock + item.quantity;
    await tx.product.update({
      where: { id: product.id },
      data: { stock: newStock },
    });
    await tx.stockMovement.create({
      data: {
        productId: product.id,
        orderId: order.id,
        type: "cancellation",
        quantity: item.quantity,
        previousStock: product.stock,
        newStock,
        reason: `Order ${order.orderNumber} cancelled — stock restored`,
      },
    });
  }
  await tx.order.update({
    where: { id: order.id },
    data: { stockDeducted: false },
  });
}

// ---------------------------------------------------------------------------
// Accounting — an order is NOT income until payment is confirmed. Income is
// recorded exactly once per verified payment, linked to the order.
// ---------------------------------------------------------------------------

export const ORDER_INCOME_CATEGORY = "Online Order Sales";
export const ORDER_REFUND_CATEGORY = "Order Refunds";

export async function ensureOrderCategories(
  tx: Prisma.TransactionClient,
): Promise<{ incomeId: string; refundId: string }> {
  const income = await tx.accountCategory.upsert({
    where: { name_type: { name: ORDER_INCOME_CATEGORY, type: "income" } },
    update: {},
    create: {
      name: ORDER_INCOME_CATEGORY,
      type: "income",
      description: "Income from verified online order payments.",
      status: "active",
    },
  });
  const refund = await tx.accountCategory.upsert({
    where: { name_type: { name: ORDER_REFUND_CATEGORY, type: "expense" } },
    update: {},
    create: {
      name: ORDER_REFUND_CATEGORY,
      type: "expense",
      description: "Refunds for cancelled online orders.",
      status: "active",
    },
  });
  return { incomeId: income.id, refundId: refund.id };
}

/**
 * Record income for one verified payment. Idempotent: the reference
 * `pay:<paymentId>` is unique per payment, so re-running never duplicates.
 */
export async function recordOrderIncome(
  tx: Prisma.TransactionClient,
  order: { id: string; orderNumber: string },
  payment: { id: string; method: string; amount: Prisma.Decimal | number },
): Promise<void> {
  const reference = `pay:${payment.id}`;
  const existing = await tx.accountTransaction.findFirst({
    where: { orderId: order.id, reference },
  });
  if (existing) return;
  const { incomeId } = await ensureOrderCategories(tx);
  await tx.accountTransaction.create({
    data: {
      type: "income",
      amount: new Prisma.Decimal(payment.amount.toString()),
      description: `Online order ${order.orderNumber} — ${PAYMENT_METHOD_LABELS[payment.method] ?? payment.method} payment`,
      date: new Date(),
      paymentMethod: PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
      reference,
      categoryId: incomeId,
      orderId: order.id,
    },
  });
}

/** Record a refund as a reversal expense. The original income row is kept. */
export async function recordOrderRefund(
  tx: Prisma.TransactionClient,
  order: { id: string; orderNumber: string },
  payment: { id: string; method: string },
  amount: number,
): Promise<void> {
  const reference = `refund:${payment.id}`;
  const existing = await tx.accountTransaction.findFirst({
    where: { orderId: order.id, reference },
  });
  if (existing) return;
  const { refundId } = await ensureOrderCategories(tx);
  await tx.accountTransaction.create({
    data: {
      type: "expense",
      amount: new Prisma.Decimal(amount.toFixed(2)),
      description: `Refund for cancelled online order ${order.orderNumber}`,
      date: new Date(),
      paymentMethod: PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
      reference,
      categoryId: refundId,
      orderId: order.id,
    },
  });
}

/** Recompute paymentStatus from verified payments vs the order total. */
export async function recomputePaymentStatus(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<string> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { payments: true },
  });
  if (!order) return "unpaid";
  if (order.paymentStatus === "refunded" || order.paymentStatus === "partially_refunded") {
    return order.paymentStatus;
  }
  const verified = order.payments
    .filter((p) => p.status === "verified")
    .reduce((s, p) => s + Number(p.amount), 0);
  const total = Number(order.total);
  let next: string;
  if (verified >= total && total > 0) next = "paid";
  else if (verified > 0) next = "partially_paid";
  else if (order.payments.some((p) => p.status === "pending_verification")) next = "pending_verification";
  else next = "unpaid";
  if (next !== order.paymentStatus) {
    await tx.order.update({ where: { id: orderId }, data: { paymentStatus: next } });
  }
  return next;
}

// ---------------------------------------------------------------------------
// Status transitions (admin + customer). Centralizes stock + history +
// notification side effects so no caller can forget them.
// ---------------------------------------------------------------------------

export async function transitionOrderStatus(
  tx: Prisma.TransactionClient,
  orderId: string,
  toStatus: string,
  changedBy: "customer" | "admin" | "system",
  changedById?: string | null,
  note?: string | null,
): Promise<void> {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found.");
  const fromStatus = order.status;
  if (fromStatus === toStatus) return;
  const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new Error(
      `Cannot move an order from ${ORDER_STATUS_LABELS[fromStatus] ?? fromStatus} to ${ORDER_STATUS_LABELS[toStatus] ?? toStatus}.`,
    );
  }

  if (toStatus === "confirmed") {
    await deductStockForOrder(tx, orderId);
  }
  if (toStatus === "cancelled") {
    await restoreStockForOrder(tx, orderId);
  }

  await tx.order.update({
    where: { id: orderId },
    data: {
      status: toStatus,
      ...(toStatus === "cancelled" && note ? { cancelReason: note } : {}),
    },
  });
  await addOrderHistory(tx, orderId, fromStatus, toStatus, changedBy, changedById, note);

  const notificationType =
    toStatus === "confirmed"
      ? "order_confirmed"
      : toStatus === "processing"
        ? "order_processing"
        : toStatus === "ready"
          ? "order_ready"
          : toStatus === "shipped"
            ? "order_shipped"
            : toStatus === "delivered"
              ? "order_delivered"
              : toStatus === "cancelled"
                ? "order_cancelled"
                : null;
  if (notificationType) {
    await createNotification(tx, orderId, order.customerId, notificationType);
  }
}

// ---------------------------------------------------------------------------
// Ownership-checked order fetching
// ---------------------------------------------------------------------------

export async function getOrderForCustomer(orderId: string, customerId: string) {
  return db.order.findFirst({
    where: { id: orderId, customerId },
    include: ORDER_INCLUDE,
  });
}

export async function getOrderByNumberForGuest(orderNumber: string, phone: string) {
  return db.order.findFirst({
    where: { orderNumber, customerPhone: phone },
    include: ORDER_INCLUDE,
  });
}

export async function getOrderByNumber(orderNumber: string) {
  return db.order.findUnique({
    where: { orderNumber },
    include: ORDER_INCLUDE,
  });
}
