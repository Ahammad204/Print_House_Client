"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Optimistic order state for the admin order detail page.
 *
 * The server round-trip on the Neon free tier is slow (a few seconds for
 * confirm, 10-15s for cancel), so the badge / stock flag / action buttons
 * must update the moment the admin clicks — not when router.refresh()
 * finally brings the new server data. This context holds the order fields
 * that change when an admin action runs; the page seeds it from the server
 * order and remounts the provider (keyed by order.updatedAt) whenever the
 * server data actually changes, so the server refresh reconciles it.
 *
 * Presentation only: every action still runs its server action and the
 * real stock / accounting / timeline changes happen there. On a server
 * error the caller restores the previous snapshot.
 */

export type OptimisticPayment = {
  id: string;
  method: string;
  amount: number;
  trxId: string | null;
  senderPhone: string | null;
  status: string;
  verifiedBy: string | null;
  verifiedAt: string | null; // ISO string
  createdAt: string; // ISO string
  /** Client-only row (e.g. a cash payment just recorded) until refresh. */
  optimistic?: boolean;
};

export type OptimisticOrderSnapshot = {
  id: string;
  status: string;
  paymentStatus: string;
  stockDeducted: boolean;
  paymentMethod: string;
  total: number;
  verifiedPaid: number;
  remaining: number;
  payments: OptimisticPayment[];
};

type OptimisticOrderContextValue = {
  order: OptimisticOrderSnapshot;
  setOrder: React.Dispatch<
    React.SetStateAction<OptimisticOrderSnapshot>
  >;
};

const OptimisticOrderContext =
  createContext<OptimisticOrderContextValue | null>(null);

export function OrderOptimisticProvider({
  snapshot,
  children,
}: {
  snapshot: OptimisticOrderSnapshot;
  children: ReactNode;
}) {
  const [order, setOrder] = useState(snapshot);
  return (
    <OptimisticOrderContext.Provider value={{ order, setOrder }}>
      {children}
    </OptimisticOrderContext.Provider>
  );
}

export function useOptimisticOrder(): OptimisticOrderContextValue {
  const ctx = useContext(OptimisticOrderContext);
  if (!ctx) {
    throw new Error(
      "useOptimisticOrder must be used inside OrderOptimisticProvider"
    );
  }
  return ctx;
}

/**
 * Client-side mirror of server-side recomputePaymentStatus (lib/orders.ts):
 * paid when verified covers the total, partially_paid when some is
 * verified, pending_verification when a mobile payment is still waiting,
 * otherwise unpaid. Refunded states are terminal and never recomputed.
 */
export function recomputeOptimisticPaymentStatus(
  snapshot: OptimisticOrderSnapshot,
  payments: OptimisticPayment[]
): string {
  if (
    snapshot.paymentStatus === "refunded" ||
    snapshot.paymentStatus === "partially_refunded"
  ) {
    return snapshot.paymentStatus;
  }
  const verified = payments
    .filter((p) => p.status === "verified")
    .reduce((s, p) => s + p.amount, 0);
  if (verified >= snapshot.total && snapshot.total > 0) return "paid";
  if (verified > 0) return "partially_paid";
  if (payments.some((p) => p.status === "pending_verification"))
    return "pending_verification";
  return "unpaid";
}
