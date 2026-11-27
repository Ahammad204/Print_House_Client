"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

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
 * STALE SNAPSHOTS (seen live 27 Nov on KGP-20261127-0006): a cancel that
 * the server HAD recorded still showed as "Confirmed" on reloaded pages
 * for 60–90s, and the timeline/invoice only updated after a manual
 * reload — the refresh after the action returned an RSC payload that
 * predated the mutation. The sync effect used to adopt ANY incoming
 * snapshot, so the locally-applied final state ("Cancelled", applied
 * only after the server confirmed it) was overwritten by the stale
 * snapshot and the UI "reverted" to Confirmed. The effect is now
 * version-aware: every snapshot carries the order's server `updatedAt`,
 * and handlers stamp the client time of each server-confirmed mutation.
 * A snapshot whose `updatedAt` clearly predates the last confirmed
 * mutation is a stale payload — it is NOT adopted; instead the provider
 * re-fetches (bounded) until a fresh snapshot arrives. Snapshots at or
 * after the mutation are server truth and are adopted, so later changes
 * (e.g. from another admin) still flow in.
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
  /** Server time (ISO) of the last change to the order row. The sync
      effect compares it with the last confirmed mutation to recognise a
      stale RSC snapshot (see the provider). */
  updatedAt: string;
};

type OptimisticOrderContextValue = {
  order: OptimisticOrderSnapshot;
  setOrder: React.Dispatch<
    React.SetStateAction<OptimisticOrderSnapshot>
  >;
  /**
   * Stamp "a server action just confirmed a final state" (client time).
   * Call it in the same tick as the setOrder that applies the final
   * state, before router.refresh(). The sync effect uses the stamp to
   * reject snapshots that predate the mutation.
   */
  noteConfirmedMutation: () => void;
};

const OptimisticOrderContext =
  createContext<OptimisticOrderContextValue | null>(null);

/**
 * How much older than a confirmed mutation a snapshot may be and still
 * count as fresh. The order's `updatedAt` is set when the mutation's
 * transaction commits — just before the action returns — so a fresh
 * snapshot is normally within 1–2s of the client's stamp; 15s covers
 * clock skew and slow networks. A stale RSC payload (seen live: 60–90s
 * old) is far outside this.
 */
const STALE_SNAPSHOT_TOLERANCE_MS = 15_000;

/** Max extra re-fetches while waiting for a fresh snapshot. */
const MAX_STALE_REFRESHES = 3;

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
  const router = useRouter();

  // Client timestamp (ms) of the last final state applied from a
  // server-confirmed action. A server action only returns { ok: true }
  // AFTER its transaction commits, so any server snapshot whose
  // `updatedAt` predates this stamp (beyond clock-skew tolerance) is a
  // stale RSC payload — it must not overwrite the confirmed local state.
  const lastConfirmedAtRef = useRef<number | null>(null);
  // Bounded re-fetches after a stale snapshot, so a transiently stale
  // refresh converges on server truth instead of looping forever.
  const staleRefreshAttemptsRef = useRef(0);

  const noteConfirmedMutation = useCallback(() => {
    lastConfirmedAtRef.current = Date.now();
    staleRefreshAttemptsRef.current = 0;
  }, []);

  // Reconcile with authoritative server data whenever a refresh brings a
  // new snapshot. Skipped while an action is in flight: the refresh may
  // carry pre-action data, and syncing it would wipe the pending state.
  // Runs only when `snapshot` changes — handler state updates do not
  // retrigger it, so a just-applied final state is never overwritten by
  // the still-stale snapshot before that action's own refresh lands.
  //
  // Version check: if a final state was applied from a confirmed action
  // and the incoming snapshot's `updatedAt` is clearly older than that
  // mutation, the snapshot is stale — keep the confirmed local state and
  // re-fetch (bounded) so the page converges on server truth, including
  // the server-rendered timeline and invoice, which only update from a
  // fresh snapshot. A snapshot at/after the mutation is server truth
  // and is adopted (it may also carry a later change from another admin).
  useEffect(() => {
    if (orderRef.current.pending) return;
    const confirmedAt = lastConfirmedAtRef.current;
    const snapUpdatedAt = Date.parse(snapshot.updatedAt);
    if (confirmedAt !== null && !Number.isNaN(snapUpdatedAt)) {
      if (snapUpdatedAt < confirmedAt - STALE_SNAPSHOT_TOLERANCE_MS) {
        if (staleRefreshAttemptsRef.current < MAX_STALE_REFRESHES) {
          staleRefreshAttemptsRef.current += 1;
          router.refresh();
        } else {
          // Give up re-fetching (e.g. the admin's clock is far off, so
          // every snapshot looks "stale"): adopt the snapshot rather
          // than holding local state forever. A manual reload
          // re-initialises from the server.
          lastConfirmedAtRef.current = null;
          staleRefreshAttemptsRef.current = 0;
          setOrder({ ...snapshot, pending: null });
        }
        return;
      }
      // Snapshot reflects the mutation (or a later change): adopt it.
      lastConfirmedAtRef.current = null;
      staleRefreshAttemptsRef.current = 0;
    }
    setOrder({ ...snapshot, pending: null });
  }, [snapshot, router]);

  return (
    <OptimisticOrderContext.Provider
      value={{ order, setOrder, noteConfirmedMutation }}
    >
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
