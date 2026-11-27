import { formatBDT, formatDate } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDeliveryAddress,
} from "@/lib/orders";
import type { InvoiceOrder, InvoiceShop } from "@/lib/invoice-pdf";

/**
 * Printable invoice. Render it inside the order detail pages; the
 * "Print Invoice" button calls window.print() and print CSS hides
 * everything except this document (see globals.css `.print-area`).
 */
export default function InvoiceDocument({
  order,
  shop,
}: {
  order: InvoiceOrder;
  shop: InvoiceShop;
}) {
  // One shared formatter (see lib/orders.ts) — same string as tracking,
  // the order success page and admin.
  const address = formatDeliveryAddress(order);

  return (
    <div className="print-area rounded-xl border border-slate-200 bg-white p-6 text-slate-800 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">
            {shop.shopName || "Kazi Gift and Print House"}
          </h2>
          {shop.address && <p className="mt-1 text-sm text-slate-600">{shop.address}</p>}
          {shop.phone && <p className="text-sm text-slate-600">{shop.phone}</p>}
          {shop.email && <p className="text-sm text-slate-600">{shop.email}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-navy">INVOICE</p>
          <p className="mt-1 text-sm text-slate-600">Order: {order.orderNumber}</p>
          <p className="text-sm text-slate-600">Date: {formatDate(order.createdAt)}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-navy">Bill To</h3>
          <p className="mt-1 text-sm">{order.customerName}</p>
          <p className="text-sm text-slate-600">{order.customerPhone}</p>
          {order.customerEmail && (
            <p className="text-sm text-slate-600">{order.customerEmail}</p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-navy">Delivery</h3>
          <p className="mt-1 text-sm">
            {order.deliveryMethod === "pickup" ? "Shop Pickup" : "Home Delivery"}
          </p>
          {order.deliveryMethod !== "pickup" && (
            <p className="text-sm text-slate-600">{address}</p>
          )}
          <p className="mt-1 text-sm text-slate-600">
            {order.deliveryName} — {order.deliveryPhone}
          </p>
        </div>
      </div>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            <th className="py-2 font-semibold text-navy">Product</th>
            <th className="py-2 text-right font-semibold text-navy">Qty</th>
            <th className="py-2 text-right font-semibold text-navy">Unit Price</th>
            <th className="py-2 text-right font-semibold text-navy">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-2 pr-2">{item.name}</td>
              <td className="py-2 text-right">{item.quantity}</td>
              <td className="py-2 text-right">{formatBDT(item.unitPrice)}</td>
              <td className="py-2 text-right">{formatBDT(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">Subtotal</span>
          <span>{formatBDT(order.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Discount</span>
          <span>-{formatBDT(order.discount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Delivery Fee</span>
          <span>{formatBDT(order.deliveryFee)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-navy">
          <span>Total</span>
          <span>{formatBDT(order.total)}</span>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-600">
        <p>
          Payment: {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod} (
          {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus})
        </p>
        <p className="mt-1">
          Order Status: {ORDER_STATUS_LABELS[order.status] ?? order.status}
        </p>
        {order.notes && <p className="mt-1">Note: {order.notes}</p>}
        <p className="mt-4 text-xs">
          Thank you for shopping with Kazi Gift and Print House!
        </p>
      </div>
    </div>
  );
}
