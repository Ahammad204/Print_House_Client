import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatBDT, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orders";

export type InvoiceOrder = {
  orderNumber: string;
  createdAt: Date | string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  deliveryMethod: string;
  deliveryName: string;
  deliveryPhone: string;
  deliveryAddress: string;
  division?: string | null;
  district?: string | null;
  upazila?: string | null;
  area?: string | null;
  postalCode?: string | null;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  notes?: string | null;
};

export type InvoiceShop = {
  shopName: string;
  phone: string;
  email: string;
  address: string;
};

/** Generate and download the order invoice as a PDF (A4). */
export function downloadInvoicePdf(order: InvoiceOrder, shop: InvoiceShop): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 48;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(shop.shopName || "Kazi Gift and Print House", margin, y);
  y += 16;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const shopLines = [shop.address, shop.phone, shop.email].filter(Boolean);
  for (const line of shopLines) {
    doc.text(line, margin, y);
    y += 13;
  }

  y += 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", margin, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const rightX = pageWidth - margin;
  doc.text(`Order: ${order.orderNumber}`, rightX, y - 14, { align: "right" });
  doc.text(`Date: ${formatDate(order.createdAt)}`, rightX, y, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.text("Bill To", margin, y);
  doc.setFont("helvetica", "normal");
  y += 14;
  doc.text(order.customerName, margin, y);
  y += 13;
  doc.text(order.customerPhone, margin, y);
  if (order.customerEmail) {
    y += 13;
    doc.text(order.customerEmail, margin, y);
  }
  y += 13;
  doc.text(
    `Delivery: ${order.deliveryMethod === "pickup" ? "Shop Pickup" : "Home Delivery"}`,
    margin,
    y,
  );
  if (order.deliveryMethod !== "pickup") {
    y += 13;
    const addr = [
      order.deliveryAddress,
      order.area,
      order.upazila,
      order.district,
      order.division,
      order.postalCode,
    ]
      .filter(Boolean)
      .join(", ");
    doc.text(addr, margin, y);
  }

  y += 18;
  autoTable(doc, {
    startY: y,
    head: [["Product", "Qty", "Unit Price", "Total"]],
    body: order.items.map((item) => [
      item.name,
      String(item.quantity),
      formatBDT(item.unitPrice),
      formatBDT(item.total),
    ]),
    theme: "grid",
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 10 },
  });

  const afterTable = (doc as unknown as { lastAutoTable?: { finalY?: number } })
    .lastAutoTable?.finalY ?? y + 40;
  let ty = afterTable + 22;
  const labelX = pageWidth - margin - 170;
  const valueX = pageWidth - margin;
  const rows: [string, string][] = [
    ["Subtotal", formatBDT(order.subtotal)],
    ["Discount", `-${formatBDT(order.discount)}`],
    ["Delivery Fee", formatBDT(order.deliveryFee)],
    ["Total", formatBDT(order.total)],
  ];
  doc.setFontSize(10);
  for (const [label, value] of rows) {
    const bold = label === "Total";
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, labelX, ty);
    doc.text(value, valueX, ty, { align: "right" });
    ty += 16;
  }

  ty += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Payment: ${PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod} (${PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus})`,
    margin,
    ty,
  );
  ty += 14;
  doc.text(
    `Order Status: ${ORDER_STATUS_LABELS[order.status] ?? order.status}`,
    margin,
    ty,
  );
  if (order.notes) {
    ty += 14;
    doc.text(`Note: ${order.notes}`, margin, ty);
  }

  ty += 28;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Thank you for shopping with Kazi Gift and Print House!", margin, ty);

  doc.save(`invoice-${order.orderNumber}.pdf`);
}
