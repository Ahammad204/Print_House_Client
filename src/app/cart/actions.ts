"use server";

import { getCustomerSession } from "@/lib/customer-auth";
import {
  addToDbCart,
  clearDbCart,
  removeDbCartItem,
  updateDbCartItem,
} from "@/lib/cart";

type ActionResult =
  | { ok: true; quantity?: number; capped?: boolean; removed?: boolean }
  | { error: string };

async function sessionOrError(): Promise<
  { id: string } | { error: string }
> {
  const session = await getCustomerSession();
  if (!session) return { error: "LOGIN_REQUIRED" };
  return session;
}

/** Add a product to the logged-in customer's DB cart. */
export async function addToCartAction(
  productId: string,
  qty: number,
): Promise<ActionResult> {
  const session = await sessionOrError();
  if ("error" in session) return session;
  try {
    const result = await addToDbCart(session.id, productId, qty);
    return { ok: true, quantity: result.quantity, capped: result.capped };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not add to cart." };
  }
}

/** Set a DB cart line's quantity (qty < 1 removes it). */
export async function updateCartItemAction(
  itemId: string,
  qty: number,
): Promise<ActionResult> {
  const session = await sessionOrError();
  if ("error" in session) return session;
  try {
    const result = await updateDbCartItem(session.id, itemId, qty);
    return {
      ok: true,
      quantity: result.quantity,
      capped: result.capped,
      removed: result.removed,
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not update cart.",
    };
  }
}

/** Remove one line from the DB cart. */
export async function removeCartItemAction(
  itemId: string,
): Promise<ActionResult> {
  const session = await sessionOrError();
  if ("error" in session) return session;
  try {
    await removeDbCartItem(session.id, itemId);
    return { ok: true, removed: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not remove item.",
    };
  }
}

/** Empty the DB cart. */
export async function clearCartAction(): Promise<ActionResult> {
  const session = await sessionOrError();
  if ("error" in session) return session;
  try {
    await clearDbCart(session.id);
    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not clear cart.",
    };
  }
}
