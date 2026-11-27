import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, CheckCircle2, Circle, MapPin, Truck } from "lucide-react";
import { requireCustomer } from "@/lib/customer-auth";
import { getSettings } from "@/lib/settings";
import { formatBDT, formatDate, formatDateTime } from "@/lib/utils";
import {
  CUSTOMER_CANCELLABLE_FROM,
  getOrderForCustomer,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/orders";
import type { InvoiceOrder, InvoiceShop } from "@/lib/invoice-pdf";
import InvoiceDocument from "@/components/orders/InvoiceDocument";
import InvoiceButtons from "@/components/orders/InvoiceButtons";
import { cancelCustomerOrder } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-violet-100 text-violet-800",
  ready: "bg-cyan-100 text-cyan-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await requireCustomer("/account/orders");
  const { orderId } = await params;

  const order = await getOrderForCustomer(orderId, session.id);
  if (!order) notFound();

  const settings = await getSettings();
  const shop: InvoiceShop = {
    shopName: settings.shopName || "Kazi Gift and Print House",
    phone: settings.phone || "",
    email: settings.email || "",
    address: settings.address || "",
  };

  const invoiceOrder: InvoiceOrder = {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    deliveryMethod: order.deliveryMethod,
    deliveryName: order.deliveryName,
    deliveryPhone: order.deliveryPhone,
    deliveryAddress: order.deliveryAddress,
    division: order.division,
    district: order.district,
    upazila: order.upazila,
    area: order.area,
    postalCode: order.postalCode,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    deliveryFee: Number(order.deliveryFee),
    total: Number(order.total),
    notes: order.notes,
  };

  const deliveryAddress = [
    order.deliveryAddress,
    order.area,
    order.upazila,
    order.district,
    order.division,
    order.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  const canCancel = (CUSTOMER_CANCELLABLE_FROM as readonly string[]).includes(
    order.status,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dark"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Orders
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy sm:text-3xl">
            Order {order.orderNumber}
          </h1>
          <p className="mt-1 text-slate-600">
            Placed on {formatDateTime(order.createdAt)}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
            STATUS_BADGE[order.status] ?? "bg-slate-100 text-slate-700"
          }`}
        >
          {ORDER_STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      {canCancel && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            This order is still pending, so you can cancel it. Cancelling
            restores the items to stock.
          </p>
          <form
            action={cancelCustomerOrder.bind(null, order.id)}
            className="mt-3"
          >
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              <Ban className="h-4 w-4" />
              Cancel this order
            </button>
          </form>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Products */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-bold text-navy">Products</h2>
          <ul className="mt-4 divide-y divide-slate-100">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {item.quantity} × {formatBDT(item.unitPrice)}
                    {item.sku ? ` · SKU ${item.sku}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-navy">
                  {formatBDT(item.total)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-medium text-navy">{formatBDT(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Discount</span>
              <span className="font-medium text-navy">
                -{formatBDT(order.discount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Delivery Fee</span>
              <span className="font-medium text-navy">
                {formatBDT(order.deliveryFee)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-navy">
              <span>Total</span>
              <span>{formatBDT(order.total)}</span>
            </div>
          </div>
        </section>

        {/* Delivery + payment */}
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
              <Truck className="h-5 w-5 text-primary" />
              Delivery Details
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Method</dt>
                <dd className="font-medium text-navy">
                  {order.deliveryMethod === "pickup"
                    ? "Shop Pickup"
                    : "Home Delivery"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Recipient</dt>
                <dd className="font-medium text-navy">
                  {order.deliveryName} · {order.deliveryPhone}
                </dd>
              </div>
              {order.deliveryMethod !== "pickup" && (
                <div>
                  <dt className="text-slate-500">Address</dt>
                  <dd className="font-medium text-navy">{deliveryAddress}</dd>
                </div>
              )}
              {order.instructions && (
                <div>
                  <dt className="text-slate-500">Instructions</dt>
                  <dd className="font-medium text-navy">{order.instructions}</dd>
                </div>
              )}
              {order.giftMessage && (
                <div>
                  <dt className="text-slate-500">Gift message</dt>
                  <dd className="font-medium text-navy">{order.giftMessage}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-navy">Payment Details</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Method</dt>
                <dd className="font-medium text-navy">
                  {PAYMENT_METHOD_LABELS[order.paymentMethod] ??
                    order.paymentMethod}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Payment status</dt>
                <dd className="font-medium text-navy">
                  {PAYMENT_STATUS_LABELS[order.paymentStatus] ??
                    order.paymentStatus}
                </dd>
              </div>
              {order.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                >
                  <p className="font-medium text-navy">
                    {formatBDT(payment.amount)} ·{" "}
                    {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Status: {payment.status}
                    {payment.trxId ? ` · TrxID: ${payment.trxId}` : ""}
                    {payment.senderPhone
                      ? ` · From: ${payment.senderPhone}`
                      : ""}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(payment.createdAt)}
                  </p>
                </div>
              ))}
              {order.payments.length === 0 && (
                <p className="text-slate-500">No payment submitted yet.</p>
              )}
            </dl>
            {order.cancelReason && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                Cancellation reason: {order.cancelReason}
              </p>
            )}
            {order.notes && (
              <p className="mt-3 text-sm text-slate-500">Note: {order.notes}</p>
            )}
          </section>
        </div>
      </div>

      {/* Timeline */}
      <section
        id="timeline"
        className="mt-6 scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-lg font-bold text-navy">Order Timeline</h2>
        {order.history.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No updates yet — your order was placed on{" "}
            {formatDate(order.createdAt)}.
          </p>
        ) : (
          <ol className="mt-4 space-y-4">
            {order.history.map((entry, index) => {
              const isLast = index === order.history.length - 1;
              return (
                <li key={entry.id} className="relative flex gap-3 pb-1">
                  {!isLast && (
                    <span className="absolute left-[9px] top-6 h-full w-px bg-slate-200" />
                  )}
                  <span className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {isLast ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Circle className="h-3 w-3 fill-current" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy">
                      {ORDER_STATUS_LABELS[entry.toStatus] ?? entry.toStatus}
                      {entry.fromStatus && (
                        <span className="font-normal text-slate-500">
                          {" "}
                          (from{" "}
                          {ORDER_STATUS_LABELS[entry.fromStatus] ??
                            entry.fromStatus}
                          )
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(entry.createdAt)}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Invoice */}
      <section className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
            <MapPin className="h-5 w-5 text-primary" />
            Invoice
          </h2>
          <InvoiceButtons order={invoiceOrder} shop={shop} />
        </div>
        <InvoiceDocument order={invoiceOrder} shop={shop} />
      </section>
    </div>
  );
}
