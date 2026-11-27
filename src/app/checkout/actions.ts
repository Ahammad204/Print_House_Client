"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrderSettings } from "@/lib/order-settings";
import { getSettings } from "@/lib/settings";
import {
  getCustomerSession,
  hashPassword,
  createCustomerSessionToken,
  customerSessionCookieOptions,
} from "@/lib/customer-auth";
import {
  normalizeBdPhone,
  passwordMeetsRequirements,
  PASSWORD_RULE_TEXT,
} from "@/lib/validation";
import {
  MOBILE_BANKING_METHODS,
  addOrderHistory,
  calculateDeliveryFee,
  createNotification,
  generateOrderNumber,
  validateCartItems,
} from "@/lib/orders";
import { getDbCartWithItems } from "@/lib/cart";
import { formatBDT } from "@/lib/utils";

const placeOrderSchema = z.object({
  items: z
    .array(z.object({ productId: z.string(), quantity: z.number() }))
    .optional(),
  name: z.string().trim().min(1, "Full name is required.").max(100),
  phone: z.string().trim().min(1, "Phone number is required."),
  email: z.string().trim().optional(),
  deliveryMethod: z.enum(["home", "pickup"]),
  addressId: z.string().nullable().optional(),
  deliveryName: z.string().trim().min(1, "Delivery name is required.").max(100),
  deliveryPhone: z.string().trim().min(1, "Delivery phone is required."),
  street: z.string().trim().optional(),
  division: z.string().trim().optional(),
  district: z.string().trim().optional(),
  upazila: z.string().trim().optional(),
  area: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
  paymentMethod: z.string().min(1, "Payment method is required."),
  trxId: z.string().trim().optional(),
  senderPhone: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional(),
  giftMessage: z.string().trim().max(500).optional(),
  createAccount: z.boolean().optional(),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export type PlaceOrderResult =
  | { ok: true; orderNumber: string }
  | { error: string };

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function uniqueTarget(error: unknown): string[] {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const target = (error.meta as { target?: unknown } | undefined)?.target;
    if (Array.isArray(target)) return target.map(String);
    if (typeof target === "string") return [target];
  }
  return [];
}

/**
 * Place an order. Prices, stock, discounts, delivery fee and totals are all
 * computed server-side — client-supplied prices/totals are never trusted.
 * The order, its items, the mobile-banking payment row, the history entry,
 * the notification and (for logged-in customers) clearing the DB cart all
 * happen in ONE database transaction. An optional new customer account is
 * created in that same transaction.
 */
export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const settings = await getOrderSettings();
  if (!settings.enableOnlineOrdering) {
    return { error: "Online ordering is currently disabled." };
  }
  const session = await getCustomerSession();
  if (!session && !settings.enableGuestCheckout) {
    return { error: "Guest checkout is disabled. Please log in to order." };
  }

  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order details." };
  }
  const data = parsed.data;

  const phone = normalizeBdPhone(data.phone);
  if (!phone) {
    return { error: "Please enter a valid Bangladeshi phone number." };
  }
  // Explicit string aliases: TS narrowing of the outer `phone` /
  // `deliveryPhone` consts does not carry into the nested transaction
  // closure below, so bind them to string-typed consts here.
  const customerPhone: string = phone;
  const email = data.email?.trim() ? data.email.trim() : undefined;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  const deliveryPhone = normalizeBdPhone(data.deliveryPhone);
  if (!deliveryPhone) {
    return { error: "Please enter a valid delivery phone number." };
  }
  const deliveryPhoneNumber: string = deliveryPhone;

  if (data.deliveryMethod === "home" && !settings.enableHomeDelivery) {
    return { error: "Home delivery is currently unavailable." };
  }
  if (data.deliveryMethod === "pickup" && !settings.enablePickup) {
    return { error: "Shop pickup is currently unavailable." };
  }
  if (data.deliveryMethod === "home") {
    if (!data.street) return { error: "Street / house address is required for home delivery." };
    if (!data.district) return { error: "District is required for home delivery." };
  }

  const paymentEnabled: Record<string, boolean> = {
    cod: settings.enableCod,
    cash_at_shop: settings.enableCashAtShop,
    bkash: settings.enableBkash,
    nagad: settings.enableNagad,
    rocket: settings.enableRocket,
  };
  if (!paymentEnabled[data.paymentMethod]) {
    return { error: "That payment method is currently unavailable." };
  }
  const isMobileBanking = (
    MOBILE_BANKING_METHODS as readonly string[]
  ).includes(data.paymentMethod);
  let senderPhone: string | null = null;
  if (isMobileBanking) {
    if (!data.trxId) {
      return { error: "Transaction ID is required for mobile banking payment." };
    }
    senderPhone = normalizeBdPhone(data.senderPhone ?? "");
    if (!senderPhone) {
      return { error: "Please enter a valid sender phone number." };
    }
  }

  const createAccount = !session && data.createAccount === true;
  if (createAccount) {
    if (!data.password || !passwordMeetsRequirements(data.password)) {
      return { error: PASSWORD_RULE_TEXT };
    }
    if (data.password !== data.confirmPassword) {
      return { error: "Passwords do not match." };
    }
    if (!email) {
      return { error: "An email address is required to create an account." };
    }
    const existing = await db.customer.findFirst({
      where: { OR: [{ phone }, { email }] },
    });
    if (existing) {
      return { error: "An account already exists — please log in." };
    }
  }

  // Items: DB cart for logged-in customers, client-posted lines for guests
  // (product ids + quantities only — prices are re-derived server-side).
  let items: { productId: string; quantity: number }[];
  if (session) {
    const cartItems = await getDbCartWithItems(session.id);
    items = cartItems.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
    }));
  } else {
    items = data.items ?? [];
  }
  if (items.length === 0) {
    return { error: "Your cart is empty." };
  }

  const shopSettings = await getSettings();
  const deliveryAddress =
    data.deliveryMethod === "pickup"
      ? shopSettings.address || "Kazi Gift and Print House"
      : (data.street ?? "");

  async function runTransaction(tx: Prisma.TransactionClient): Promise<{
    orderNumber: string;
    newCustomerId: string | null;
  }> {
    let customerId: string | null = session?.id ?? null;

    if (createAccount) {
      const clash = await tx.customer.findFirst({
        where: { OR: [{ phone: customerPhone }, { email: email! }] },
      });
      if (clash) {
        throw new Error("ACCOUNT_EXISTS");
      }
      const created = await tx.customer.create({
        data: {
          name: data.name,
          phone: customerPhone,
          email: email ?? null,
          password: await hashPassword(data.password!),
        },
      });
      customerId = created.id;
    }

    const { lines, subtotal, discount } = await validateCartItems(tx, items);
    // subtotal here is the effective (after-discount) sum; the stored
    // "subtotal" is the pre-discount sum so subtotal - discount + fee = total.
    if (settings.minOrderAmount > 0 && subtotal < settings.minOrderAmount) {
      throw new Error(
        `Minimum order amount is ${formatBDT(settings.minOrderAmount)}.`,
      );
    }
    const deliveryFee = calculateDeliveryFee(
      subtotal,
      data.deliveryMethod,
      data.area,
      data.district,
      settings,
    );
    const total = subtotal + deliveryFee;
    const orderNumber = await generateOrderNumber(tx);

    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId,
        customerName: data.name,
        customerPhone,
        customerEmail: email ?? null,
        deliveryMethod: data.deliveryMethod,
        deliveryName: data.deliveryName,
        deliveryPhone: deliveryPhoneNumber,
        deliveryAddress,
        division: data.division || null,
        district: data.district || null,
        upazila: data.upazila || null,
        area: data.area || null,
        postalCode: data.postalCode || null,
        instructions: data.instructions || null,
        paymentMethod: data.paymentMethod,
        paymentStatus: isMobileBanking ? "pending_verification" : "unpaid",
        status: "pending",
        subtotal: subtotal + discount,
        discount,
        deliveryFee,
        total,
        notes: data.notes || null,
        giftMessage: data.giftMessage || null,
        items: {
          create: lines.map((line) => ({
            productId: line.productId,
            name: line.name,
            image: line.image,
            sku: line.sku,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            discount: line.discount,
            total: line.total,
          })),
        },
        ...(isMobileBanking
          ? {
              payments: {
                create: {
                  method: data.paymentMethod,
                  amount: total,
                  trxId: data.trxId!.trim(),
                  senderPhone,
                  status: "pending_verification",
                },
              },
            }
          : {}),
      },
    });

    await addOrderHistory(
      tx,
      order.id,
      null,
      "pending",
      customerId ? "customer" : "system",
      customerId,
      "Order placed",
    );
    await createNotification(tx, order.id, customerId, "order_placed");

    if (session) {
      const cart = await tx.cart.findUnique({
        where: { customerId: session.id },
      });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
    }

    return { orderNumber, newCustomerId: createAccount ? customerId : null };
  }

  try {
    let result: { orderNumber: string; newCustomerId: string | null };
    try {
      result = await db.$transaction(runTransaction);
    } catch (e) {
      // Order-number collision (same-day sequence race): retry once with a
      // fresh number. The failed transaction rolled back, so retrying is safe.
      if (isUniqueViolation(e) && uniqueTarget(e).includes("orderNumber")) {
        result = await db.$transaction(runTransaction);
      } else {
        throw e;
      }
    }

    // Log the newly created account in right away.
    if (result.newCustomerId) {
      const { token, maxAge } = await createCustomerSessionToken(
        result.newCustomerId,
      );
      const cookieStore = await cookies();
      const options = customerSessionCookieOptions(maxAge);
      cookieStore.set(options.name, token, {
        httpOnly: options.httpOnly,
        sameSite: options.sameSite,
        secure: options.secure,
        path: options.path,
        maxAge: options.maxAge,
      });
    }

    return { ok: true, orderNumber: result.orderNumber };
  } catch (e) {
    if (e instanceof Error && e.message === "ACCOUNT_EXISTS") {
      return { error: "An account already exists — please log in." };
    }
    if (isUniqueViolation(e)) {
      const target = uniqueTarget(e);
      if (target.includes("phone") || target.includes("email")) {
        return { error: "An account already exists — please log in." };
      }
      return { error: "Something went wrong while placing your order. Please try again." };
    }
    return {
      error: e instanceof Error ? e.message : "Could not place your order.",
    };
  }
}
