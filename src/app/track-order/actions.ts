"use server";

import { headers } from "next/headers";
import { getOrderByNumberForGuest } from "@/lib/orders";
import { normalizeBdPhone } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

export type TrackedOrder = {
  orderNumber: string;
  createdAt: string;
  status: string;
  total: number;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  paymentMethod: string;
  paymentStatus: string;
  deliveryMethod: string;
  deliveryName: string;
  deliveryPhone: string;
  deliveryAddress: string;
  area: string | null;
  district: string | null;
  upazila: string | null;
  division: string | null;
  postalCode: string | null;
  customerName: string;
  items: { id: string; name: string; quantity: number; unitPrice: number; total: number }[];
  history: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    changedBy: string;
    note: string | null;
    createdAt: string;
  }[];
};

export type TrackOrderState =
  | { error: string; order?: undefined }
  | { order: TrackedOrder; error?: undefined }
  | null;

const GENERIC_ERROR =
  "No order found with that order number and phone number.";

/** Guest order tracking — order number + phone must match the order. */
export async function trackOrder(
  _prevState: TrackOrderState,
  formData: FormData,
): Promise<TrackOrderState> {
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";
  const limit = checkRateLimit(`track-order:${ip}`, 5, 60_000);
  if (!limit.allowed) {
    return {
      error: `Too many attempts. Please try again in ${limit.retryAfterSeconds} seconds.`,
    };
  }

  const orderNumber = String(formData.get("orderNumber") ?? "")
    .trim()
    .toUpperCase();
  const rawPhone = String(formData.get("phone") ?? "").trim();
  if (!orderNumber || !rawPhone) {
    return { error: "Order number and phone number are both required." };
  }
  const phone = normalizeBdPhone(rawPhone);
  if (!phone) {
    return { error: GENERIC_ERROR };
  }

  const order = await getOrderByNumberForGuest(orderNumber, phone);
  if (!order) {
    // One generic error for both "no such order" and "phone mismatch" so
    // the existence of an order number cannot be probed.
    return { error: GENERIC_ERROR };
  }

  return {
    order: {
      orderNumber: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      deliveryFee: Number(order.deliveryFee),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      deliveryMethod: order.deliveryMethod,
      deliveryName: order.deliveryName,
      deliveryPhone: order.deliveryPhone,
      deliveryAddress: order.deliveryAddress,
      area: order.area,
      district: order.district,
      upazila: order.upazila,
      division: order.division,
      postalCode: order.postalCode,
      customerName: order.customerName,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
      history: order.history.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        changedBy: h.changedBy,
        note: h.note,
        createdAt: h.createdAt.toISOString(),
      })),
    },
  };
}
