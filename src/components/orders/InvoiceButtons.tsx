"use client";

import { Download, Printer } from "lucide-react";
import { downloadInvoicePdf, type InvoiceOrder, type InvoiceShop } from "@/lib/invoice-pdf";

/** Print + PDF download buttons for an order invoice. */
export default function InvoiceButtons({
  order,
  shop,
}: {
  order: InvoiceOrder;
  shop: InvoiceShop;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
      >
        <Printer className="h-4 w-4" />
        Print Invoice
      </button>
      <button
        type="button"
        onClick={() => downloadInvoicePdf(order, shop)}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
      >
        <Download className="h-4 w-4" />
        Download PDF
      </button>
    </div>
  );
}
