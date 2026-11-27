import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { db as prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import {
  formatBDT,
  formatDate,
  formatDateTime,
  toNumber,
} from "@/lib/utils";
import {
  ALLOWED_TRANSITIONS,
  ORDER_INCLUDE,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDeliveryAddress,
} from "@/lib/orders";
import { Button } from "@/components/ui/button";
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
import InvoiceDocument from "@/components/orders/InvoiceDocument";
import InvoiceButtons from "@/components/orders/InvoiceButtons";
import type { InvoiceOrder, InvoiceShop } from "@/lib/invoice-pdf";
import {
  CancelOrderButton,
  DeliveryForm,
  MarkPaymentReceivedButton,
  NoteForm,
  PaymentVerifyButtons,
  StatusButtons,
} from "./OrderActions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `880${digits.slice(1)}`;
  return digits;
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await requireAdmin();
  const { orderId } = await params;

  const [order, settings] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    }),
    getSettings(),
  ]);

  if (!order) notFound();

  const verifiedPaid = order.payments
    .filter((p) => p.status === "verified")
    .reduce((s, p) => s + toNumber(p.amount), 0);
  const total = toNumber(order.total);
  const remaining = Math.max(0, total - verifiedPaid);

  const nextStatuses = (ALLOWED_TRANSITIONS[order.status] ?? []).filter(
    (s) => s !== "cancelled"
  );
  const canCancel = (ALLOWED_TRANSITIONS[order.status] ?? []).includes(
    "cancelled"
  );
  const canEditDelivery =
    order.status === "pending" || order.status === "confirmed";
  const canMarkReceived =
    (order.paymentMethod === "cod" || order.paymentMethod === "cash_at_shop") &&
    remaining > 0 &&
    order.paymentStatus !== "refunded" &&
    order.paymentStatus !== "partially_refunded";

  // One shared formatter (see lib/orders.ts) — same string as tracking,
  // the order success page and the invoice.
  const deliveryAddress = formatDeliveryAddress(order);

  const waNumber = whatsappNumber(order.customerPhone);
  const waMessage = encodeURIComponent(
    `Hello ${order.customerName}, this is Kazi Gift and Print House regarding your order ${order.orderNumber} (${formatBDT(order.total)}).`
  );

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
      unitPrice: toNumber(item.unitPrice),
      total: toNumber(item.total),
    })),
    subtotal: toNumber(order.subtotal),
    discount: toNumber(order.discount),
    deliveryFee: toNumber(order.deliveryFee),
    total,
    notes: order.notes,
  };

  const shop: InvoiceShop = {
    shopName: settings.shopName ?? "Kazi Gift and Print House",
    phone: settings.phone ?? "",
    email: settings.email ?? "",
    address: settings.address ?? "",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-navy">
              Order {order.orderNumber}
            </h1>
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
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Placed {formatDateTime(order.createdAt)}
            {order.customerId && (
              <>
                {" · "}
                <Link
                  href={`/admin/customers/${order.customerId}`}
                  className="text-primary hover:underline"
                >
                  View customer
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/orders">Back to Orders</Link>
          </Button>
          <Button variant="outline" asChild>
            <a
              href={`https://wa.me/${waNumber}?text=${waMessage}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="mr-1.5 h-4 w-4" />
              WhatsApp Customer
            </a>
          </Button>
          <InvoiceButtons order={invoiceOrder} shop={shop} />
        </div>
      </div>

      {/* Admin actions */}
      {(nextStatuses.length > 0 || canCancel || canMarkReceived) && (
        <Card>
          <CardHeader>
            <CardTitle>Order Actions</CardTitle>
            <CardDescription>
              Confirming an order deducts stock; cancelling restores it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {nextStatuses.length > 0 && (
              <StatusButtons orderId={order.id} nextStatuses={nextStatuses} />
            )}
            <div className="flex flex-wrap gap-2">
              {canMarkReceived && (
                <MarkPaymentReceivedButton
                  orderId={order.id}
                  remaining={remaining}
                />
              )}
              {canCancel && <CancelOrderButton orderId={order.id} />}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Order info */}
        <Card>
          <CardHeader>
            <CardTitle>Order Info</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Order Number</dt>
                <dd className="font-medium">{order.orderNumber}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Payment Method</dt>
                <dd className="font-medium">
                  {PAYMENT_METHOD_LABELS[order.paymentMethod] ??
                    order.paymentMethod}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Payment Status</dt>
                <dd className="font-medium">
                  {PAYMENT_STATUS_LABELS[order.paymentStatus] ??
                    order.paymentStatus}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Delivery Method</dt>
                <dd className="font-medium">
                  {order.deliveryMethod === "pickup"
                    ? "Shop Pickup"
                    : "Home Delivery"}
                </dd>
              </div>
              {order.notes && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Customer Note</dt>
                  <dd className="text-right font-medium">{order.notes}</dd>
                </div>
              )}
              {order.giftMessage && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Gift Message</dt>
                  <dd className="text-right font-medium">{order.giftMessage}</dd>
                </div>
              )}
              {order.cancelReason && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Cancellation Reason</dt>
                  <dd className="text-right font-medium text-red-600">
                    {order.cancelReason}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Stock Deducted</dt>
                <dd className="font-medium">
                  {order.stockDeducted ? "Yes" : "No"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Customer info */}
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium">{order.customerName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Phone</dt>
                <dd className="font-medium">{order.customerPhone}</dd>
              </div>
              {order.customerEmail && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Email</dt>
                  <dd className="font-medium">{order.customerEmail}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Account</dt>
                <dd className="font-medium">
                  {order.customerId ? "Registered customer" : "Guest order"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Products */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.sku ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatBDT(item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatBDT(item.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Financial summary */}
        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Subtotal</dt>
                <dd>{formatBDT(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Discount</dt>
                <dd>-{formatBDT(order.discount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Delivery Fee</dt>
                <dd>{formatBDT(order.deliveryFee)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t pt-2 text-base font-bold text-navy">
                <dt>Total</dt>
                <dd>{formatBDT(total)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Verified Paid</dt>
                <dd className="font-medium text-green-600">
                  {formatBDT(verifiedPaid)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Remaining</dt>
                <dd
                  className={cn(
                    "font-medium",
                    remaining > 0 ? "text-red-600" : "text-green-600"
                  )}
                >
                  {formatBDT(remaining)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Delivery details */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <CardTitle>Delivery Details</CardTitle>
            {canEditDelivery && (
              <DeliveryForm
                orderId={order.id}
                initial={{
                  deliveryName: order.deliveryName,
                  deliveryPhone: order.deliveryPhone,
                  deliveryAddress: order.deliveryAddress,
                  division: order.division,
                  district: order.district,
                  upazila: order.upazila,
                  area: order.area,
                  postalCode: order.postalCode,
                  instructions: order.instructions,
                }}
              />
            )}
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Recipient</dt>
                <dd className="text-right font-medium">
                  {order.deliveryName} — {order.deliveryPhone}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Address</dt>
                <dd className="text-right font-medium">{deliveryAddress}</dd>
              </div>
              {order.instructions && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Instructions</dt>
                  <dd className="text-right font-medium">
                    {order.instructions}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Records</CardTitle>
          <CardDescription>
            Mobile-banking payments need verification before the income is
            recorded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {order.payments.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No payment records yet.
              {order.paymentMethod === "cod" ||
              order.paymentMethod === "cash_at_shop"
                ? " Use “Mark Payment Received” once the cash is in hand."
                : ""}
            </p>
          ) : (
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
                            orderId={order.id}
                            paymentId={payment.id}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <NoteForm orderId={order.id} />
          {order.history.length === 0 ? (
            <p className="text-sm text-slate-500">No history yet.</p>
          ) : (
            <ol className="space-y-4 border-l-2 border-slate-200 pl-4">
              {order.history.map((entry) => {
                const isNote = entry.fromStatus === entry.toStatus;
                return (
                  <li key={entry.id} className="relative">
                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-primary" />
                    <p className="text-sm font-medium text-navy">
                      {isNote
                        ? "Internal note"
                        : `${ORDER_STATUS_LABELS[entry.fromStatus ?? ""] ?? entry.fromStatus ?? "—"} → ${ORDER_STATUS_LABELS[entry.toStatus] ?? entry.toStatus}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(entry.createdAt)} · by{" "}
                      {entry.changedBy === "admin"
                        ? "Admin"
                        : entry.changedBy === "customer"
                          ? "Customer"
                          : "System"}
                    </p>
                    {entry.note && (
                      <p className="mt-1 text-sm text-slate-700">{entry.note}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Invoice */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-navy">Invoice</h2>
        <InvoiceDocument order={invoiceOrder} shop={shop} />
      </div>
    </div>
  );
}
