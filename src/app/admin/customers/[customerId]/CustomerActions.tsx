"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { KeyRound, ShieldOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  generatePasswordResetLink,
  toggleCustomerStatus,
  updateCustomerNotes,
} from "./actions";

export function CustomerNotesForm({
  customerId,
  initialNotes,
}: {
  customerId: string;
  initialNotes: string | null;
}) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("notes", notes);
    startTransition(async () => {
      const result = await updateCustomerNotes(customerId, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Notes saved");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="customer-notes">Internal Notes</Label>
        <Textarea
          id="customer-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Admin-only notes about this customer."
          rows={4}
        />
      </div>
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Saving..." : "Save Notes"}
      </Button>
    </form>
  );
}

export function CustomerStatusToggle({
  customerId,
  status,
}: {
  customerId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();
  const isActive = status === "active";

  return (
    <Button
      type="button"
      variant={isActive ? "outline" : "default"}
      className={isActive ? "text-red-600 hover:bg-red-50" : ""}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await toggleCustomerStatus(customerId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(
            isActive ? "Customer disabled" : "Customer activated"
          );
        });
      }}
    >
      {isActive ? (
        <>
          <ShieldOff className="mr-1.5 h-4 w-4" />
          Disable Account
        </>
      ) : (
        <>
          <ShieldCheck className="mr-1.5 h-4 w-4" />
          Activate Account
        </>
      )}
    </Button>
  );
}

/**
 * Generates the one-time reset link and shows it ONCE to the admin.
 * The raw token is never stored in the page state beyond this display.
 */
export function PasswordResetLinkButton({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await generatePasswordResetLink(customerId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setResetUrl(result.url);
          });
        }}
      >
        <KeyRound className="mr-1.5 h-4 w-4" />
        {isPending ? "Generating..." : "Generate Password Reset Link"}
      </Button>

      {resetUrl && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            One-time reset link for {customerName}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Share this link privately with the customer only. It expires in
            1 hour, works once, and will not be shown again. Never post it in
            a group chat.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              readOnly
              value={resetUrl}
              onFocus={(e) => e.target.select()}
              className="h-10 w-full min-w-0 rounded-md border border-amber-300 bg-white px-3 py-2 font-mono text-xs"
              aria-label="One-time password reset link"
            />
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(resetUrl);
                  toast.success("Link copied");
                } catch {
                  toast.error("Copy failed — select the link manually");
                }
              }}
            >
              Copy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setResetUrl(null)}
            >
              Hide
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
