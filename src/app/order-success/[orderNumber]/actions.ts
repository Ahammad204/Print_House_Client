"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOrderByNumberForGuest } from "@/lib/orders";
import { normalizeBdPhone } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  orderSuccessCookieOptions,
  signOrderSuccessToken,
} from "@/lib/auth";

export type VerifyOrderPhoneState = { error: string } | null;

const GENERIC_ERROR =
  "No order found with that order number and phone number.";

/**
 * Verify order number + checkout phone for the order-success page.
 *
 * POST (not GET) so the phone number never appears in the URL, browser
 * history, or server logs. Verification is exactly like /track-order:
 * normalizeBdPhone + getOrderByNumberForGuest, rate-limited per IP, with
 * one generic error for "no such order" and "wrong phone".
 *
 * On success sets a short-lived signed cookie scoped to this order's
 * page and redirects back to it; the page treats a valid cookie as proof
 * of ownership.
 */
export async function verifyOrderPhone(
  _prevState: VerifyOrderPhoneState,
  formData: FormData,
): Promise<VerifyOrderPhoneState> {
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";
  const limit = checkRateLimit(`order-success:${ip}`, 5, 60_000);
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
    return { error: GENERIC_ERROR };
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

  const token = await signOrderSuccessToken(order.orderNumber);
  const options = orderSuccessCookieOptions(order.orderNumber);
  const store = await cookies();
  store.set(options.name, token, {
    httpOnly: options.httpOnly,
    sameSite: options.sameSite,
    secure: options.secure,
    path: options.path,
    maxAge: options.maxAge,
  });
  redirect(`/order-success/${order.orderNumber}`);
}
