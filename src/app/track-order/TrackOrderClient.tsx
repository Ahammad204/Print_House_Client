"use client";

import { useActionState } from "react";
import { Package } from "lucide-react";
import { formatBDT, formatDateTime } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDeliveryAddress,
} from "@/lib/orders";
import { trackOrder } from "./actions";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
const labelCls = "mb-1 block text-sm font-medium text-navy";

export default function TrackOrderClient() {
  const [state, formAction, isPending] = useActionState(trackOrder, null);
  const order = state?.order ?? null;

  // One shared formatter (see lib/orders.ts) — same string as the order
  // success page, admin and the invoice.
  const deliveryAddress = order ? formatDeliveryAddress(order) : "";

  return (
    <div>
      <form
        action={formAction}
        className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="to-order-number">
              Order number *
            </label>
            <input
              id="to-order-number"
              name="orderNumber"
              required
              className={inputCls}
              placeholder="e.g. KGP-20261127-0001"
              autoComplete="off"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="to-phone">
              Phone number *
            </label>
            <input
              id="to-phone"
              name="phone"
              required
              className={inputCls}
              placeholder="01XXXXXXXXX"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
        </div>
        {state?.error && (
          <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
        >
          {isPending ? "Searching…" : "Track Order"}
        </button>
      </form>

      {order && (
        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Order</p>
                <p className="text-xl font-bold text-navy">{order.orderNumber}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Placed on {formatDateTime(order.createdAt)}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                <Package className="h-4 w-4" />
                {ORDER_STATUS_LABELS[order.status] ?? order.status}
              </span>
            </div>

            <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-surface p-3">
                <dt className="font-semibold text-navy">Customer</dt>
                <dd className="mt-1 text-slate-600">{order.customerName}</dd>
              </div>
              <div className="rounded-lg bg-surface p-3">
                <dt className="font-semibold text-navy">Payment</dt>
                <dd className="mt-1 text-slate-600">
                  {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod} —{" "}
                  {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                </dd>
              </div>
              <div className="rounded-lg bg-surface p-3 sm:col-span-2">
                <dt className="font-semibold text-navy">Delivery</dt>
                <dd className="mt-1 text-slate-600">
                  {order.deliveryMethod === "pickup" ? "Shop Pickup" : "Home Delivery"}
                  {order.deliveryMethod !== "pickup" && deliveryAddress && (
                    <> — {deliveryAddress}</>
                  )}
                  <br />
                  {order.deliveryName} — {order.deliveryPhone}
                </dd>
              </div>
            </dl>

            <h3 className="mt-5 font-bold text-navy">Items</h3>
            <ul className="mt-2 divide-y divide-slate-100">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="text-slate-600">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-medium text-navy">
                    {formatBDT(item.total)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Subtotal</dt>
                <dd className="text-navy">{formatBDT(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-600">Discount</dt>
                  <dd className="text-green-700">-{formatBDT(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-600">Delivery fee</dt>
                <dd className="text-navy">{formatBDT(order.deliveryFee)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-navy">
                <dt>Total</dt>
                <dd>{formatBDT(order.total)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <h3 className="font-bold text-navy">Order Timeline</h3>
            {order.history.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No updates yet.</p>
            ) : (
              <ol className="mt-4 space-y-4">
                {order.history.map((h) => (
                  <li key={h.id} className="flex gap-3">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm font-semibold text-navy">
                        {ORDER_STATUS_LABELS[h.toStatus] ?? h.toStatus}
                        {h.fromStatus && (
                          <span className="font-normal text-slate-500">
                            {" "}
                            (from {ORDER_STATUS_LABELS[h.fromStatus] ?? h.fromStatus})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(h.createdAt)}
                      </p>
                      {h.note && (
                        <p className="mt-1 text-sm text-slate-600">{h.note}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
