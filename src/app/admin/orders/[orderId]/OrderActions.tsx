"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Check, Loader2, MessageSquare, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ALLOWED_TRANSITIONS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/orders";
import { cn, formatBDT, formatDateTime } from "@/lib/utils";
import {
  recomputeOptimisticPaymentStatus,
  useOptimisticOrder,
  type OptimisticPayment,
} from "./optimistic-order";
import {
  addInternalNote,
  advanceOrderStatus,
  cancelOrder,
  markPaymentReceived,
  rejectMobilePayment,
  updateDeliveryInfo,
  verifyMobilePayment,
} from "./actions";

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  confirmed: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  processing: "bg-violet-100 text-violet-800 hover:bg-violet-100",
  ready: "bg-cyan-100 text-cyan-800 hover:bg-cyan-100",
  shipped: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
  delivered: "bg-green-100 text-green-800 hover:bg-green-100",
  cancelled: "bg-red-100 text-red-800 hover:bg-red-100",
};

const PAYMENT_STATUS_BADGE_CLASS: Record<string, string> = {
  unpaid: "bg-red-100 text-red-800 hover:bg-red-100",
  pending_verification: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  partially_paid: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  paid: "bg-green-100 text-green-800 hover:bg-green-100",
  refunded: "bg-slate-200 text-slate-700 hover:bg-slate-200",
  partially_refunded: "bg-orange-100 text-orange-800 hover:bg-orange-100",
};

const PAYMENT_BADGE_CLASS: Record<string, string> = {
  pending_verification: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  verified: "bg-green-100 text-green-800 hover:bg-green-100",
  rejected: "bg-red-100 text-red-800 hover:bg-red-100",
};

/**
 * Optimistic display: the status + payment badges, stock flag, money
 * figures and payment rows read the optimistic order state, so they flip
 * the moment an action is clicked. The server refresh (keyed on
 * order.updatedAt) reconciles them with the authoritative data afterwards.
 */
export function OrderStatusBadges() {
  const { order } = useOptimisticOrder();
  return (
    <>
      <Badge
        className={
          STATUS_BADGE_CLASS[order.status] ??
          "bg-slate-100 text-slate-700 hover:bg-slate-100"
        }
      >
        {ORDER_STATUS_LABELS[order.status] ?? order.status}
      </Badge>
      <Badge
        className={
          PAYMENT_STATUS_BADGE_CLASS[order.paymentStatus] ??
          "bg-slate-100 text-slate-700 hover:bg-slate-100"
        }
      >
        {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
      </Badge>
    </>
  );
}

export function StockDeductedValue() {
  const { order } = useOptimisticOrder();
  return <>{order.stockDeducted ? "Yes" : "No"}</>;
}

export function PaymentStatusValue() {
  const { order } = useOptimisticOrder();
  return (
    <>{PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}</>
  );
}

export function VerifiedPaidValue() {
  const { order } = useOptimisticOrder();
  return <>{formatBDT(order.verifiedPaid)}</>;
}

export function RemainingValue() {
  const { order } = useOptimisticOrder();
  return (
    <span
      className={cn(
        order.remaining > 0 ? "text-red-600" : "text-green-600"
      )}
    >
      {formatBDT(order.remaining)}
    </span>
  );
}

/** The whole actions card, driven by the optimistic status. */
export function OrderActionsCard({ orderId }: { orderId: string }) {
  const { order } = useOptimisticOrder();
  const nextStatuses = (ALLOWED_TRANSITIONS[order.status] ?? []).filter(
    (s) => s !== "cancelled"
  );
  const canCancel = (ALLOWED_TRANSITIONS[order.status] ?? []).includes(
    "cancelled"
  );
  const canMarkReceived =
    (order.paymentMethod === "cod" ||
      order.paymentMethod === "cash_at_shop") &&
    order.remaining > 0 &&
    order.paymentStatus !== "refunded" &&
    order.paymentStatus !== "partially_refunded";

  if (nextStatuses.length === 0 && !canCancel && !canMarkReceived) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Actions</CardTitle>
        <CardDescription>
          Confirming an order deducts stock; cancelling restores it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {nextStatuses.length > 0 && <StatusButtons orderId={orderId} />}
        <div className="flex flex-wrap gap-2">
          {canMarkReceived && (
            <MarkPaymentReceivedButton orderId={orderId} />
          )}
          {canCancel && <CancelOrderButton orderId={orderId} />}
        </div>
      </CardContent>
    </Card>
  );
}

/** Buttons for each allowed next status (cancel has its own form). */
export function StatusButtons({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { order, setOrder } = useOptimisticOrder();
  // Busy only while the server action itself runs. It clears as soon as
  // the action resolves — the slow router.refresh() afterwards must NOT
  // keep the button stuck on "Updating…" (the old behaviour).
  const [busy, setBusy] = useState<string | null>(null);
  const nextStatuses = (ALLOWED_TRANSITIONS[order.status] ?? []).filter(
    (s) => s !== "cancelled"
  );

  return (
    <div className="flex flex-wrap gap-2">
      {nextStatuses.map((toStatus) => (
        <Button
          key={toStatus}
          type="button"
          disabled={busy !== null}
          onClick={async () => {
            if (busy) return;
            // Optimistic: flip the badge / buttons / stock flag now; the
            // server refresh reconciles afterwards. Revert on error.
            const prev = order;
            setOrder((s) => ({
              ...s,
              status: toStatus,
              stockDeducted:
                toStatus === "confirmed"
                  ? true
                  : toStatus === "cancelled"
                    ? false
                    : s.stockDeducted,
            }));
            setBusy(toStatus);
            const result = await advanceOrderStatus(orderId, toStatus);
            setBusy(null);
            if (!result.ok) {
              setOrder(prev);
              toast.error(result.error);
              return;
            }
            toast.success(
              `Order moved to ${ORDER_STATUS_LABELS[toStatus] ?? toStatus}`
            );
            router.refresh();
          }}
        >
          {busy === toStatus ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-1.5 h-4 w-4" />
          )}
          {busy === toStatus
            ? "Updating…"
            : `Mark as ${ORDER_STATUS_LABELS[toStatus] ?? toStatus}`}
        </Button>
      ))}
    </div>
  );
}

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { order, setOrder } = useOptimisticOrder();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("reason", reason);
    const prev = order;
    // Optimistic: cancelled badge, stock restored, refund status — the
    // same rules the server applies in cancelOrder.
    const verifiedTotal = order.payments
      .filter((p) => p.status === "verified")
      .reduce((s, p) => s + p.amount, 0);
    setOrder((s) => ({
      ...s,
      status: "cancelled",
      stockDeducted: false,
      paymentStatus:
        verifiedTotal > 0
          ? verifiedTotal >= s.total
            ? "refunded"
            : "partially_refunded"
          : s.paymentStatus,
    }));
    setIsPending(true);
    const result = await cancelOrder(orderId, formData);
    setIsPending(false);
    if (!result.ok) {
      setOrder(prev);
      toast.error(result.error);
      return;
    }
    toast.success("Order cancelled");
    setOpen(false);
    setReason("");
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setOpen(true)}
      >
        <X className="mr-1.5 h-4 w-4" />
        Cancel Order
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel order</DialogTitle>
            <DialogDescription>
              The order will be cancelled and any deducted stock restored.
              Verified payments will be recorded as refunds.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Cancellation reason</Label>
              <Textarea
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer requested cancellation"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Keep Order
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending ? "Cancelling..." : "Cancel Order"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Confirm cash received (COD / Cash at Shop) — the only way COD income is recorded. */
export function MarkPaymentReceivedButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { order, setOrder } = useOptimisticOrder();
  const [isPending, setIsPending] = useState(false);

  return (
    <Button
      type="button"
      disabled={isPending}
      onClick={async () => {
        if (isPending) return;
        const prev = order;
        // Optimistic: paid badge, remaining 0, and a provisional payment
        // row (replaced by the real record when the refresh lands).
        const optimisticPayment: OptimisticPayment = {
          id: `optimistic-${Date.now()}`,
          method: order.paymentMethod,
          amount: order.remaining,
          trxId: null,
          senderPhone: null,
          status: "verified",
          verifiedBy: "Admin",
          verifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          optimistic: true,
        };
        setOrder((s) => ({
          ...s,
          paymentStatus: "paid",
          remaining: 0,
          verifiedPaid: s.total,
          payments: [optimisticPayment, ...s.payments],
        }));
        setIsPending(true);
        const result = await markPaymentReceived(orderId);
        setIsPending(false);
        if (!result.ok) {
          setOrder(prev);
          toast.error(result.error);
          return;
        }
        toast.success("Payment received and recorded as income");
        router.refresh();
      }}
    >
      {isPending
        ? "Recording..."
        : `Mark Payment Received (${formatBDT(order.remaining)})`}
    </Button>
  );
}

/** Verify / reject buttons for one pending mobile-banking payment. */
export function PaymentVerifyButtons({
  orderId,
  paymentId,
}: {
  orderId: string;
  paymentId: string;
}) {
  const router = useRouter();
  const { order, setOrder } = useOptimisticOrder();
  const [isPending, setIsPending] = useState(false);

  async function run(
    action: (orderId: string, paymentId: string) => Promise<{ ok: boolean; error?: string }>,
    toStatus: "verified" | "rejected",
    successMessage: string
  ) {
    if (isPending) return;
    const prev = order;
    const payments = order.payments.map((p) =>
      p.id === paymentId
        ? {
            ...p,
            status: toStatus,
            verifiedBy: toStatus === "verified" ? "Admin" : p.verifiedBy,
            verifiedAt:
              toStatus === "verified"
                ? new Date().toISOString()
                : p.verifiedAt,
          }
        : p
    );
    const verifiedPaid = payments
      .filter((p) => p.status === "verified")
      .reduce((s, p) => s + p.amount, 0);
    setOrder((s) => ({
      ...s,
      payments,
      verifiedPaid,
      remaining: Math.max(0, s.total - verifiedPaid),
      paymentStatus: recomputeOptimisticPaymentStatus(s, payments),
    }));
    setIsPending(true);
    const result = await action(orderId, paymentId);
    setIsPending(false);
    if (!result.ok) {
      setOrder(prev);
      toast.error(result.error ?? "Could not update the payment.");
      return;
    }
    toast.success(successMessage);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() =>
          run(verifyMobilePayment, "verified", "Payment verified and recorded as income")
        }
      >
        <Check className="mr-1 h-3.5 w-3.5" />
        Verify
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="text-red-600 hover:bg-red-50"
        disabled={isPending}
        onClick={() => run(rejectMobilePayment, "rejected", "Payment rejected")}
      >
        <X className="mr-1 h-3.5 w-3.5" />
        Reject
      </Button>
    </div>
  );
}

/** Payment records table body, driven by the optimistic state. */
export function PaymentsCardContent({ orderId }: { orderId: string }) {
  const { order } = useOptimisticOrder();

  if (order.payments.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-500">
        No payment records yet.
        {order.paymentMethod === "cod" ||
        order.paymentMethod === "cash_at_shop"
          ? " Use “Mark Payment Received” once the cash is in hand."
          : ""}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>TrxID</TableHead>
            <TableHead>Sender Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Verified By</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="whitespace-nowrap">
                {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatBDT(payment.amount)}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {payment.trxId ?? "—"}
              </TableCell>
              <TableCell>{payment.senderPhone ?? "—"}</TableCell>
              <TableCell>
                <Badge
                  className={
                    PAYMENT_BADGE_CLASS[payment.status] ??
                    "bg-slate-100 text-slate-700 hover:bg-slate-100"
                  }
                >
                  {payment.status === "pending_verification"
                    ? "Pending Verification"
                    : payment.status === "verified"
                      ? "Verified"
                      : "Rejected"}
                </Badge>
              </TableCell>
              <TableCell>
                {payment.verifiedBy ?? "—"}
                {payment.verifiedAt && (
                  <div className="text-xs text-slate-500">
                    {formatDateTime(payment.verifiedAt)}
                  </div>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDateTime(payment.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                {payment.status === "pending_verification" && (
                  <PaymentVerifyButtons
                    orderId={orderId}
                    paymentId={payment.id}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function NoteForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("note", note);
    startTransition(async () => {
      const result = await addInternalNote(orderId, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Note added");
      setNote("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="internal-note">Add an internal note</Label>
        <Textarea
          id="internal-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Only visible to admins, shown in the timeline."
          required
        />
      </div>
      <Button type="submit" variant="outline" disabled={isPending}>
        <MessageSquare className="mr-1.5 h-4 w-4" />
        {isPending ? "Adding..." : "Add Note"}
      </Button>
    </form>
  );
}

export type DeliveryInfo = {
  deliveryName: string;
  deliveryPhone: string;
  deliveryAddress: string;
  division: string | null;
  district: string | null;
  upazila: string | null;
  area: string | null;
  postalCode: string | null;
  instructions: string | null;
};

export function DeliveryForm({
  orderId,
  initial,
}: {
  orderId: string;
  initial: DeliveryInfo;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateDeliveryInfo(orderId, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Delivery details updated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="mr-1.5 h-4 w-4" />
        Edit Delivery Details
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit delivery details</DialogTitle>
            <DialogDescription>
              Delivery details can only be changed while the order is pending
              or confirmed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deliveryName">Recipient Name</Label>
                <Input
                  id="deliveryName"
                  name="deliveryName"
                  defaultValue={initial.deliveryName}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryPhone">Recipient Phone</Label>
                <Input
                  id="deliveryPhone"
                  name="deliveryPhone"
                  defaultValue={initial.deliveryPhone}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="deliveryAddress">Address</Label>
                <Textarea
                  id="deliveryAddress"
                  name="deliveryAddress"
                  defaultValue={initial.deliveryAddress}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="division">Division</Label>
                <Input
                  id="division"
                  name="division"
                  defaultValue={initial.division ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Input
                  id="district"
                  name="district"
                  defaultValue={initial.district ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upazila">Upazila</Label>
                <Input
                  id="upazila"
                  name="upazila"
                  defaultValue={initial.upazila ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area">Area</Label>
                <Input id="area" name="area" defaultValue={initial.area ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  defaultValue={initial.postalCode ?? ""}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="instructions">Delivery Instructions</Label>
                <Textarea
                  id="instructions"
                  name="instructions"
                  defaultValue={initial.instructions ?? ""}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
