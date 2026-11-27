/**
 * Guest cart — client-side only, stored in localStorage. Logged-in customers
 * use the database cart instead (see /api/cart routes + cart server actions);
 * on login the guest cart is merged into the database cart and then cleared.
 */
export type GuestCartItem = { productId: string; quantity: number };

const KEY = "kgp-guest-cart-v1";

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("kgp-cart-changed"));
  }
}

export function readGuestCart(): GuestCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (i): i is GuestCartItem =>
          typeof i === "object" &&
          i !== null &&
          typeof (i as GuestCartItem).productId === "string" &&
          typeof (i as GuestCartItem).quantity === "number",
      )
      .map((i) => ({
        productId: i.productId,
        quantity: Math.max(1, Math.floor(i.quantity)),
      }));
  } catch {
    return [];
  }
}

function writeGuestCart(items: GuestCartItem[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(items));
  notify();
}

export function addGuestItem(productId: string, quantity: number): void {
  const items = readGuestCart();
  const existing = items.find((i) => i.productId === productId);
  if (existing) {
    existing.quantity += Math.max(1, Math.floor(quantity));
  } else {
    items.push({ productId, quantity: Math.max(1, Math.floor(quantity)) });
  }
  writeGuestCart(items);
}

export function setGuestItemQuantity(productId: string, quantity: number): void {
  const qty = Math.floor(quantity);
  let items = readGuestCart();
  if (qty < 1) {
    items = items.filter((i) => i.productId !== productId);
  } else {
    const existing = items.find((i) => i.productId === productId);
    if (existing) existing.quantity = qty;
    else items.push({ productId, quantity: qty });
  }
  writeGuestCart(items);
}

export function removeGuestItem(productId: string): void {
  writeGuestCart(readGuestCart().filter((i) => i.productId !== productId));
}

export function clearGuestCart(): void {
  writeGuestCart([]);
}

export function countGuestItems(): number {
  return readGuestCart().reduce((s, i) => s + i.quantity, 0);
}
