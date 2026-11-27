"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { countGuestItems } from "@/lib/cart-store";

/**
 * Cart icon with a count badge, linking to /cart.
 * - Guest: count comes from the local guest cart (cart-store) and updates
 *   on the "kgp-cart-changed" window event.
 * - Logged-in customer (customer prop passed): count comes from
 *   /api/cart/count; a failed/unavailable endpoint degrades to 0.
 * The badge is hidden when the count is 0.
 */
export default function CartBadge({
  customer,
}: {
  customer?: { name: string } | null;
}) {
  const loggedIn = Boolean(customer);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (loggedIn) {
        try {
          const res = await fetch("/api/cart/count", { cache: "no-store" });
          if (!res.ok) throw new Error("cart count unavailable");
          const data: unknown = await res.json();
          const next =
            typeof data === "object" &&
            data !== null &&
            typeof (data as { count?: unknown }).count === "number"
              ? (data as { count: number }).count
              : 0;
          if (!cancelled) setCount(next);
        } catch {
          if (!cancelled) setCount(0);
        }
      } else if (!cancelled) {
        setCount(countGuestItems());
      }
    }

    refresh();
    window.addEventListener("kgp-cart-changed", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("kgp-cart-changed", refresh);
    };
  }, [loggedIn]);

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart, ${count} items` : "Cart"}
      className="relative rounded-lg p-2 text-navy transition hover:bg-slate-100"
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
