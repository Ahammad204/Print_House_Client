"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { formatBDT } from "@/lib/utils";
import {
  readGuestCart,
  setGuestItemQuantity,
  removeGuestItem,
  clearGuestCart,
} from "@/lib/cart-store";
import {
  updateCartItemAction,
  removeCartItemAction,
  clearCartAction,
} from "./actions";

export type CartLine = {
  /** DB cart item id when logged in, otherwise the product id. */
  key: string;
  itemId: string | null;
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  unitPrice: number;
  originalPrice: number;
  stock: number;
  status: string;
  quantity: number;
};

type ProductSnapshot = {
  id: string;
  name: string;
  slug: string;
  price: number;
  discountPrice: number | null;
  image: string | null;
  stock: number;
  status: string;
};

function effectivePrice(p: { price: number; discountPrice: number | null }): {
  unit: number;
  original: number;
} {
  if (
    p.discountPrice !== null &&
    p.discountPrice > 0 &&
    p.discountPrice < p.price
  ) {
    return { unit: p.discountPrice, original: p.price };
  }
  return { unit: p.price, original: p.price };
}

export default function CartClient({
  isLoggedIn,
  initialItems,
  defaultDeliveryFee,
  freeDeliveryThreshold,
}: {
  isLoggedIn: boolean;
  initialItems: CartLine[];
  defaultDeliveryFee: number;
  freeDeliveryThreshold: number;
}) {
  const [lines, setLines] = useState<CartLine[]>(initialItems);
  const [loadingGuest, setLoadingGuest] = useState(!isLoggedIn);
  const [notice, setNotice] = useState<string | null>(null);

  // Guest cart lives in localStorage — resolve it against live product data.
  useEffect(() => {
    if (isLoggedIn) return;
    const guestItems = readGuestCart();
    if (guestItems.length === 0) {
      setLines([]);
      setLoadingGuest(false);
      return;
    }
    const ids = guestItems.map((i) => i.productId).join(",");
    fetch(`/api/cart/products?ids=${encodeURIComponent(ids)}`)
      .then((r) => r.json() as Promise<ProductSnapshot[]>)
      .then((products) => {
        const byId = new Map(products.map((p) => [p.id, p]));
        const resolved: CartLine[] = [];
        let capped = false;
        for (const item of guestItems) {
          const p = byId.get(item.productId);
          if (!p) continue; // hidden / deleted product — drop silently
          const qty = Math.min(item.quantity, Math.max(0, p.stock));
          if (qty < item.quantity) capped = true;
          if (qty < 1) continue;
          const { unit, original } = effectivePrice(p);
          resolved.push({
            key: p.id,
            itemId: null,
            productId: p.id,
            name: p.name,
            slug: p.slug,
            image: p.image,
            unitPrice: unit,
            originalPrice: original,
            stock: p.stock,
            status: p.status,
            quantity: qty,
          });
        }
        if (capped) {
          setNotice(
            "Some quantities were reduced to match available stock.",
          );
        }
        setLines(resolved);
      })
      .catch(() => setLines([]))
      .finally(() => setLoadingGuest(false));
  }, [isLoggedIn]);

  const effectiveSubtotal = lines.reduce(
    (s, l) => s + l.unitPrice * l.quantity,
    0,
  );
  const originalSubtotal = lines.reduce(
    (s, l) => s + l.originalPrice * l.quantity,
    0,
  );
  const discount = originalSubtotal - effectiveSubtotal;
  const deliveryFee =
    lines.length === 0
      ? 0
      : freeDeliveryThreshold > 0 && effectiveSubtotal >= freeDeliveryThreshold
        ? 0
        : defaultDeliveryFee;
  const grandTotal = effectiveSubtotal + deliveryFee;

  function notifyCartChanged() {
    window.dispatchEvent(new Event("kgp-cart-changed"));
  }

  async function changeQuantity(line: CartLine, nextQty: number) {
    setNotice(null);
    if (isLoggedIn && line.itemId) {
      const result = await updateCartItemAction(line.itemId, nextQty);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.removed) {
        setLines((prev) => prev.filter((l) => l.key !== line.key));
      } else {
        if (result.capped) {
          setNotice(
            `"${line.name}" quantity was reduced to the available stock (${result.quantity}).`,
          );
        }
        setLines((prev) =>
          prev.map((l) =>
            l.key === line.key
              ? { ...l, quantity: result.quantity ?? nextQty }
              : l,
          ),
        );
      }
      notifyCartChanged();
      return;
    }
    // Guest cart
    const cappedQty = Math.min(Math.max(0, nextQty), line.stock);
    if (nextQty > line.stock) {
      setNotice(
        `"${line.name}" quantity was reduced to the available stock (${line.stock}).`,
      );
    }
    setGuestItemQuantity(line.productId, cappedQty);
    setLines((prev) =>
      cappedQty < 1
        ? prev.filter((l) => l.key !== line.key)
        : prev.map((l) =>
            l.key === line.key ? { ...l, quantity: cappedQty } : l,
          ),
    );
  }

  async function removeLine(line: CartLine) {
    if (isLoggedIn && line.itemId) {
      const result = await removeCartItemAction(line.itemId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      notifyCartChanged();
    } else {
      removeGuestItem(line.productId);
    }
    setLines((prev) => prev.filter((l) => l.key !== line.key));
  }

  async function clearAll() {
    if (!window.confirm("Remove all items from your cart?")) return;
    if (isLoggedIn) {
      const result = await clearCartAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      notifyCartChanged();
    } else {
      clearGuestCart();
    }
    setLines([]);
  }

  if (loadingGuest) {
    return (
      <p className="py-16 text-center text-slate-500">Loading your cart…</p>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-slate-300" />
        <h2 className="mt-4 text-xl font-bold text-navy">Your cart is empty</h2>
        <p className="mt-2 text-slate-500">
          Browse our gifts, printing and stationery items and add something you like.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white transition hover:bg-primary-dark"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {notice && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="flex-1">{notice}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setNotice(null)}
              className="rounded p-0.5 hover:bg-amber-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {lines.map((line) => (
            <li key={line.key} className="flex gap-4 p-4">
              <Link
                href={`/products/${line.slug}`}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100"
              >
                <Image
                  src={line.image ?? "/images/products/gift-box.svg"}
                  alt={line.name}
                  fill
                  className="object-cover"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/products/${line.slug}`}
                    className="font-semibold text-navy hover:text-primary"
                  >
                    {line.name}
                  </Link>
                  <button
                    type="button"
                    aria-label={`Remove ${line.name}`}
                    onClick={() => removeLine(line)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {formatBDT(line.unitPrice)} each
                  {line.originalPrice > line.unitPrice && (
                    <span className="ml-2 text-slate-400 line-through">
                      {formatBDT(line.originalPrice)}
                    </span>
                  )}
                </p>
                {line.status !== "available" && (
                  <p className="mt-1 text-sm font-medium text-red-600">
                    This product is no longer available — remove it before checkout.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center rounded-lg border border-slate-300">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => changeQuantity(line, line.quantity - 1)}
                      className="p-2 text-navy transition hover:bg-slate-100 disabled:opacity-40"
                      disabled={line.quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center text-sm font-semibold text-navy">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => changeQuantity(line, line.quantity + 1)}
                      className="p-2 text-navy transition hover:bg-slate-100 disabled:opacity-40"
                      disabled={line.quantity >= line.stock}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="text-base font-bold text-navy">
                    {formatBDT(line.unitPrice * line.quantity)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {line.stock} in stock
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-lg border border-primary px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
          >
            Continue Shopping
          </Link>
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Clear Cart
          </button>
        </div>
      </div>

      <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-bold text-navy">Order Summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="font-medium text-navy">{formatBDT(originalSubtotal)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-slate-600">Discount</dt>
              <dd className="font-medium text-green-700">
                -{formatBDT(discount)}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-slate-600">
              Delivery fee <span className="text-xs">(estimated)</span>
            </dt>
            <dd className="font-medium text-navy">
              {deliveryFee === 0 ? "Free" : formatBDT(deliveryFee)}
            </dd>
          </div>
          {freeDeliveryThreshold > 0 && (
            <p className="text-xs text-slate-500">
              Free delivery on orders of {formatBDT(freeDeliveryThreshold)} or
              more. Final delivery fee is confirmed at checkout.
            </p>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-navy">
            <dt>Grand total</dt>
            <dd>{formatBDT(grandTotal)}</dd>
          </div>
        </dl>
        <Link
          href="/checkout"
          className="mt-5 flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white transition hover:bg-primary-dark"
        >
          Proceed to Checkout
        </Link>
      </aside>
    </div>
  );
}
