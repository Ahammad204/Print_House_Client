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
  ORDER_INCLUDE,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  formatDeliveryAddress,
} from "@/lib/orders";
import { Button } from "@/components/ui/button";
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
  DeliveryForm,
  NoteForm,
  OrderActionsCard,
  OrderStatusBadges,
  PaymentStatusValue,
  PaymentsCardContent,
  RemainingValue,
  StockDeductedValue,
  VerifiedPaidValue,
} from "./OrderActions";
import {
  OrderOptimisticProvider,
  type OptimisticOrderSnapshot,
} from "./optimistic-order";

export const dynamic = "force-dynamic";

// Never serve a cached copy of this page: order data changes on every
// admin action, and a stale detail is how a cancelled order kept showing
// as "Confirmed" after a mutation (seen live 27 Nov). Belt-and-braces
// with force-dynamic above; the client also reconciles snapshots by
// `updatedAt` (see optimistic-order.tsx).
export const revalidate = 0;

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

  const canEditDelivery =
    order.status === "pending" || order.status === "confirmed";

  // Optimistic state for the admin actions (see optimistic-order.tsx).
  // The provider is keyed by the STABLE order id and reconciles server
  // data via an effect in the provider — it must NOT remount on refresh:
  // the old key={order.updatedAt} destroyed all client state inside it
  // (e.g. an open cancel dialog) whenever a slow refresh landed.
  const optimisticSnapshot: OptimisticOrderSnapshot = {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    stockDeducted: order.stockDeducted,
    paymentMethod: order.paymentMethod,
    total,
    verifiedPaid,
    remaining,
    pending: null,
    updatedAt: order.updatedAt.toISOString(),
    payments: order.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: toNumber(p.amount),
      trxId: p.trxId,
      senderPhone: p.senderPhone,
      status: p.status,
      verifiedBy: p.verifiedBy,
      verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
    })),
  };

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
      <OrderOptimisticProvider key={order.id} snapshot={optimisticSnapshot}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-navy">
              Order {order.orderNumber}
            </h1>
            <OrderStatusBadges />
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

      {/* Admin actions — while an action runs the badges show an honest
          pending state ("Cancelling…"); the final state is only applied
          once the server confirms. See OrderActionsCard /
          optimistic-order.tsx. */}
      <OrderActionsCard orderId={order.id} />

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
                  <PaymentStatusValue />
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
                  <StockDeductedValue />
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
                  <VerifiedPaidValue />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Remaining</dt>
                <dd className="font-medium">
                  <RemainingValue />
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
          <PaymentsCardContent orderId={order.id} />
        </CardContent>
      </Card>

      </OrderOptimisticProvider>

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
