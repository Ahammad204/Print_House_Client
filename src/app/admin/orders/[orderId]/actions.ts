"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  ALLOWED_TRANSITIONS,
  MOBILE_BANKING_METHODS,
  addOrderHistory,
  createNotification,
  recordOrderIncome,
  recordOrderRefund,
  recomputePaymentStatus,
  transitionOrderStatus,
} from "@/lib/orders";

type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateOrder(orderId: string) {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/dashboard");
}

const deliverySchema = z.object({
  deliveryName: z.string().trim().min(1, "Delivery name is required"),
  deliveryPhone: z.string().trim().min(1, "Delivery phone is required"),
  deliveryAddress: z.string().trim().min(1, "Delivery address is required"),
  division: z.string().trim().optional(),
  district: z.string().trim().optional(),
  upazila: z.string().trim().optional(),
  area: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
});

/** Move the order to one of its allowed next statuses. */
export async function advanceOrderStatus(
  orderId: string,
  toStatus: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("Order not found.");
      const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
      if (!allowed.includes(toStatus)) {
        throw new Error(
          `Cannot move this order from ${order.status} to ${toStatus}.`
        );
      }
      await transitionOrderStatus(tx, orderId, toStatus, "admin", admin.id);
    });
    revalidateOrder(orderId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not update the order.",
    };
  }
}

/** Cancel the order; verified payments are refunded as expense reversals. */
export async function cancelOrder(
  orderId: string,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    return { ok: false, error: "A cancellation reason is required." };
  }
  try {
    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { payments: true },
      });
      if (!order) throw new Error("Order not found.");
      if (order.status === "cancelled") {
        throw new Error("This order is already cancelled.");
      }
      if (order.status === "delivered") {
        throw new Error("A delivered order cannot be cancelled.");
      }

      await transitionOrderStatus(
        tx,
        orderId,
        "cancelled",
        "admin",
        admin.id,
        reason
      );

      const verified = order.payments.filter((p) => p.status === "verified");
      const verifiedTotal = verified.reduce(
        (s, p) => s + Number(p.amount),
        0
      );
      if (verifiedTotal > 0) {
        for (const payment of verified) {
          await recordOrderRefund(
            tx,
            { id: order.id, orderNumber: order.orderNumber },
            { id: payment.id, method: payment.method },
            Number(payment.amount)
          );
        }
        const total = Number(order.total);
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus:
              verifiedTotal >= total ? "refunded" : "partially_refunded",
          },
        });
      }
    });
    revalidateOrder(orderId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not cancel the order.",
    };
  }
}

/**
 * Confirm cash payment received for COD / Cash at Shop orders. This is the
 * ONLY place COD income is recorded — only when the admin confirms the
 * money was actually received.
 */
export async function markPaymentReceived(
  orderId: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { payments: true },
      });
      if (!order) throw new Error("Order not found.");
      if (
        order.paymentMethod !== "cod" &&
        order.paymentMethod !== "cash_at_shop"
      ) {
        throw new Error(
          "Payment can only be marked received for Cash on Delivery or Cash at Shop orders."
        );
      }
      if (
        order.paymentStatus === "refunded" ||
        order.paymentStatus === "partially_refunded"
      ) {
        throw new Error("This order has been refunded.");
      }
      const verified = order.payments
        .filter((p) => p.status === "verified")
        .reduce((s, p) => s + Number(p.amount), 0);
      const remaining = Number(order.total) - verified;
      if (remaining <= 0) {
        throw new Error("This order is already fully paid.");
      }

      const payment = await tx.orderPayment.create({
        data: {
          orderId: order.id,
          method: order.paymentMethod,
          amount: new Prisma.Decimal(remaining.toFixed(2)),
          status: "verified",
          verifiedBy: admin.name,
          verifiedAt: new Date(),
          note: "Cash payment received — confirmed by admin.",
        },
      });
      await recordOrderIncome(
        tx,
        { id: order.id, orderNumber: order.orderNumber },
        { id: payment.id, method: payment.method, amount: payment.amount }
      );
      await recomputePaymentStatus(tx, order.id);
      await createNotification(tx, order.id, order.customerId, "payment_verified");
    });
    revalidateOrder(orderId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Could not record the payment.",
    };
  }
}

/** Verify a submitted mobile-banking payment and record the income. */
export async function verifyMobilePayment(
  orderId: string,
  paymentId: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    await db.$transaction(async (tx) => {
      const payment = await tx.orderPayment.findUnique({
        where: { id: paymentId },
        include: { order: true },
      });
      if (!payment || payment.orderId !== orderId) {
        throw new Error("Payment not found.");
      }
      if (!(MOBILE_BANKING_METHODS as readonly string[]).includes(payment.method)) {
        throw new Error("Only mobile banking payments can be verified here.");
      }
      if (payment.status !== "pending_verification") {
        throw new Error(`This payment is already ${payment.status}.`);
      }
      const updated = await tx.orderPayment.update({
        where: { id: payment.id },
        data: {
          status: "verified",
          verifiedBy: admin.name,
          verifiedAt: new Date(),
        },
      });
      await recordOrderIncome(
        tx,
        { id: payment.order.id, orderNumber: payment.order.orderNumber },
        { id: updated.id, method: updated.method, amount: updated.amount }
      );
      await recomputePaymentStatus(tx, orderId);
      await createNotification(
        tx,
        orderId,
        payment.order.customerId,
        "payment_verified"
      );
    });
    revalidateOrder(orderId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Could not verify the payment.",
    };
  }
}

/** Reject a submitted mobile-banking payment. */
export async function rejectMobilePayment(
  orderId: string,
  paymentId: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    await db.$transaction(async (tx) => {
      const payment = await tx.orderPayment.findUnique({
        where: { id: paymentId },
      });
      if (!payment || payment.orderId !== orderId) {
        throw new Error("Payment not found.");
      }
      if (payment.status !== "pending_verification") {
        throw new Error(`This payment is already ${payment.status}.`);
      }
      await tx.orderPayment.update({
        where: { id: payment.id },
        data: { status: "rejected" },
      });
      await recomputePaymentStatus(tx, orderId);
    });
    revalidateOrder(orderId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Could not reject the payment.",
    };
  }
}

/** Add an internal note (shown in the order timeline). */
export async function addInternalNote(
  orderId: string,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  if (!note) {
    return { ok: false, error: "Note cannot be empty." };
  }
  try {
    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("Order not found.");
      await addOrderHistory(
        tx,
        orderId,
        order.status,
        order.status,
        "admin",
        admin.id,
        note
      );
    });
    revalidateOrder(orderId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not add the note.",
    };
  }
}

/** Edit delivery details — only while the order is pending or confirmed. */
export async function updateDeliveryInfo(
  orderId: string,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  void admin;
  const parsed = deliverySchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  try {
    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("Order not found.");
      if (order.status !== "pending" && order.status !== "confirmed") {
        throw new Error(
          "Delivery details can only be edited while the order is pending or confirmed."
        );
      }
      await tx.order.update({
        where: { id: orderId },
        data: {
          deliveryName: parsed.data.deliveryName,
          deliveryPhone: parsed.data.deliveryPhone,
          deliveryAddress: parsed.data.deliveryAddress,
          division: parsed.data.division || null,
          district: parsed.data.district || null,
          upazila: parsed.data.upazila || null,
          area: parsed.data.area || null,
          postalCode: parsed.data.postalCode || null,
          instructions: parsed.data.instructions || null,
        },
      });
    });
    revalidateOrder(orderId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Could not update the delivery details.",
    };
  }
}
