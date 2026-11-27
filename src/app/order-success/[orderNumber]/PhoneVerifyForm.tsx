"use client";

import { useActionState } from "react";
import { verifyOrderPhone } from "./actions";

/**
 * Phone-ownership check for the order-success page. POSTs to the
 * verifyOrderPhone server action so the phone number never appears in
 * the URL. On success the action sets a signed cookie and redirects to
 * the same page, which then renders the full order.
 */
export default function PhoneVerifyForm({
  orderNumber,
}: {
  orderNumber: string;
}) {
  const [state, formAction, isPending] = useActionState(
    verifyOrderPhone,
    null,
  );
  return (
    <>
      <form action={formAction} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="orderNumber" value={orderNumber} />
        <label htmlFor="os-phone" className="sr-only">
          Phone number used at checkout
        </label>
        <input
          id="os-phone"
          name="phone"
          required
          className="w-full flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          placeholder="01XXXXXXXXX"
          inputMode="tel"
          autoComplete="tel"
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
        >
          {isPending ? "Checking…" : "View My Order"}
        </button>
      </form>
      {state?.error && (
        <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
    </>
  );
}
