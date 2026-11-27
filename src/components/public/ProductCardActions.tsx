"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ShoppingCart, Zap } from "lucide-react";
import { addGuestItem } from "@/lib/cart-store";
import { addToCartAction } from "@/app/cart/actions";

export type CardActionProduct = {
  id: string;
  name: string;
  price: unknown;
  stock: number;
  status: string;
};

/**
 * Add to Cart / Buy Now buttons for a product card.
 * `isLoggedIn` may be omitted — in that case a server call is attempted
 * first and a LOGIN_REQUIRED response falls back to the guest cart.
 */
export default function ProductCardActions({
  product,
  isLoggedIn,
}: {
  product: CardActionProduct;
  isLoggedIn?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const available = product.status === "available" && product.stock > 0;

  async function add(buyNow: boolean) {
    if (!available || busy) return;
    setBusy(true);
    try {
      if (isLoggedIn === false) {
        addGuestItem(product.id, 1);
        toast.success("Added to cart");
      } else {
        const result = await addToCartAction(product.id, 1);
        if ("error" in result) {
          if (result.error === "LOGIN_REQUIRED") {
            addGuestItem(product.id, 1);
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
        className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500"
      >
        Out of Stock
      </button>
    );
  }

  return (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        onClick={() => add(false)}
        disabled={busy}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:opacity-60"
      >
        <ShoppingCart className="h-4 w-4" />
        Add to Cart
      </button>
      <button
        type="button"
        onClick={() => add(true)}
        disabled={busy}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
      >
        <Zap className="h-4 w-4" />
        Buy Now
      </button>
    </div>
  );
}
