"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Minus, Plus, ShoppingCart, Zap } from "lucide-react";
import { addGuestItem } from "@/lib/cart-store";
import { addToCartAction } from "@/app/cart/actions";

export type ProductActionProduct = {
  id: string;
  name: string;
  price: unknown;
  stock: number;
  status: string;
};

/** Quantity selector + Add to Cart / Buy Now for the product detail page. */
export default function ProductActions({
  product,
  isLoggedIn,
}: {
  product: ProductActionProduct;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const available = product.status === "available" && product.stock > 0;

  async function add(buyNow: boolean) {
    if (!available || busy) return;
    setBusy(true);
    try {
      if (!isLoggedIn) {
        addGuestItem(product.id, qty);
        toast.success("Added to cart");
      } else {
        const result = await addToCartAction(product.id, qty);
        if ("error" in result) {
          if (result.error === "LOGIN_REQUIRED") {
            addGuestItem(product.id, qty);
            toast.success("Added to cart");
          } else {
            toast.error(result.error);
            return;
          }
        } else if (result.capped) {
          toast.success(`Added to cart (only ${result.quantity} in stock).`);
        } else {
          toast.success("Added to cart");
        }
      }
      window.dispatchEvent(new Event("kgp-cart-changed"));
      if (buyNow) router.push("/checkout");
    } finally {
      setBusy(false);
    }
  }

  if (!available) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex cursor-not-allowed items-center justify-center rounded-lg bg-slate-200 px-6 py-3 text-base font-semibold text-slate-500"
      >
        Out of Stock
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center rounded-lg border border-slate-300">
        <button
          type="button"
          aria-label="Decrease quantity"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          disabled={qty <= 1}
          className="p-3 text-navy transition hover:bg-slate-100 disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-10 text-center text-base font-semibold text-navy">
          {qty}
        </span>
        <button
          type="button"
          aria-label="Increase quantity"
          onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
          disabled={qty >= product.stock}
          className="p-3 text-navy transition hover:bg-slate-100 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => add(false)}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary px-6 py-3 text-base font-semibold text-primary transition hover:bg-primary/5 disabled:opacity-60"
      >
        <ShoppingCart className="h-5 w-5" />
        Add to Cart
      </button>
      <button
        type="button"
        onClick={() => add(true)}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
      >
        <Zap className="h-5 w-5" />
        Buy Now
      </button>
    </div>
  );
}
