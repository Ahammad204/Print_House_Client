"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Optimistic order state for the admin order detail page.
 *
 * The server round-trip on the Neon free tier is slow (a few seconds for
 * confirm, 10-15s for cancel), so the admin needs instant feedback when
 * they click — but it must be HONEST feedback. The old code flipped the
 * badge / stock flag to the FINAL state the moment an action was clicked;
 * if the admin reloaded mid-flight, the in-flight request was aborted, the
 * server never recorded the change, and the page had already declared
 * success (seen live 27 Nov on KGP-20261127-0004: badge said "Cancelled"
 * while the order was still "Confirmed" server-side).
 *
 * So the rule now is: while a server action is in flight, the snapshot
 * shows an explicit PENDING state (e.g. "Cancelling…", visually distinct
 * from the final badge) and the final fields are untouched. Only when the
 * server action resolves successfully do the final fields change. On
 * error, nothing was ever shown as final, so there is nothing to revert
 * — the pending state just clears and an error toast is shown. A reload
 * mid-flight simply shows the server truth; nothing was ever claimed.
 *
 * Reconciliation with the server: the provider is keyed by the STABLE
 * order id (not by updatedAt) and syncs the server snapshot via an effect
 * whenever a refresh brings new data — but never while an action is in
 * flight, because the refresh may still carry pre-action data. The old
 * key-by-updatedAt remount had a second failure: it destroyed all client
 * state inside the provider whenever a slow refresh landed, so a cancel
 * dialog opened during the refresh after Confirm was wiped before the
 * admin could use it (the "first click does nothing" bug).
 *
 * Presentation only: every action still runs its server action and the
 * real stock / accounting / timeline changes happen there.
 */

/**
 * An admin action currently in flight. The final state is NOT applied
 * until the server action resolves; the UI shows `label` instead.
 */
export type PendingAction = {
  kind: "status" | "cancel" | "payment" | "verify" | "reject";
  /** Badge label while the server action runs, e.g. "Cancelling…". */
  label: string;
  /** Order status the action will set once the server confirms it. */
  targetStatus?: string;
  /** Payment status the action will set once the server confirms it. */
  targetPaymentStatus?: string;
  /** Stock flag the action will set once the server confirms it. */
  targetStockDeducted?: boolean;
  /** Payment row the action targets (verify/reject only). */
  targetPaymentId?: string;
};

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
  /** In-flight admin action, or null. Drives the pending badges/buttons. */
  pending: PendingAction | null;
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
  // Latest committed order, for the sync effect: the effect must not read
  // a stale `order` closure when deciding whether an action is in flight.
  const orderRef = useRef(order);
  orderRef.current = order;

  // Reconcile with authoritative server data whenever a refresh brings a
  // new snapshot. Skipped while an action is in flight: the refresh may
  // carry pre-action data, and syncing it would wipe the pending state.
  // Runs only when `snapshot` changes — handler state updates do not
  // retrigger it, so a just-applied final state is never overwritten by
  // the still-stale snapshot before that action's own refresh lands.
  useEffect(() => {
    if (orderRef.current.pending) return;
    setOrder({ ...snapshot, pending: null });
  }, [snapshot]);

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

/** True when the pending action will change the payment status badge. */
export function pendingAffectsPayment(
  pending: PendingAction | null
): boolean {
  return (
    !!pending &&
    (pending.kind === "payment" ||
      pending.kind === "verify" ||
      pending.kind === "reject" ||
      pending.targetPaymentStatus !== undefined)
  );
}

/** Badge label for the payment side of a pending action. */
export function paymentPendingLabel(pending: PendingAction): string {
  if (pending.kind === "payment") return "Recording payment…";
  if (pending.kind === "verify") return "Verifying payment…";
  if (pending.kind === "reject") return "Rejecting payment…";
  return "Updating…";
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
