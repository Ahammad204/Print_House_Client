"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Check, MessageSquare, Pencil, X } from "lucide-react";
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
import { ORDER_STATUS_LABELS } from "@/lib/orders";
import {
  addInternalNote,
  advanceOrderStatus,
  cancelOrder,
  markPaymentReceived,
  rejectMobilePayment,
  updateDeliveryInfo,
  verifyMobilePayment,
} from "./actions";

/** Buttons for each allowed next status (cancel has its own form). */
export function StatusButtons({
  orderId,
  nextStatuses,
}: {
  orderId: string;
  nextStatuses: string[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {nextStatuses.map((toStatus) => (
        <Button
          key={toStatus}
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const result = await advanceOrderStatus(orderId, toStatus);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success(
                `Order moved to ${ORDER_STATUS_LABELS[toStatus] ?? toStatus}`
              );
            });
          }}
        >
          <Check className="mr-1.5 h-4 w-4" />
          Mark as {ORDER_STATUS_LABELS[toStatus] ?? toStatus}
        </Button>
      ))}
    </div>
  );
}

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("reason", reason);
    startTransition(async () => {
      const result = await cancelOrder(orderId, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Order cancelled");
      setOpen(false);
      setReason("");
    });
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
export function MarkPaymentReceivedButton({
  orderId,
  remaining,
}: {
  orderId: string;
  remaining: number;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await markPaymentReceived(orderId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Payment received and recorded as income");
        });
      }}
    >
      {isPending ? "Recording..." : `Mark Payment Received (${remaining})`}
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
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await verifyMobilePayment(orderId, paymentId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Payment verified and recorded as income");
          });
        }}
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
        onClick={() => {
          startTransition(async () => {
            const result = await rejectMobilePayment(orderId, paymentId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Payment rejected");
          });
        }}
      >
        <X className="mr-1 h-3.5 w-3.5" />
        Reject
      </Button>
    </div>
  );
}

export function NoteForm({ orderId }: { orderId: string }) {
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
