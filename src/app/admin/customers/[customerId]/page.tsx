import Link from "next/link";
import { notFound } from "next/navigation";
import { db as prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatBDT, formatDate, formatDateTime, toNumber } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
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
import {
  CustomerNotesForm,
  CustomerStatusToggle,
  PasswordResetLinkButton,
} from "./CustomerActions";

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

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  await requireAdmin();
  const { customerId } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!customer) notFound();

  const [totalOrders, purchasedAgg] = await Promise.all([
    prisma.order.count({ where: { customerId: customer.id } }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        customerId: customer.id,
        paymentStatus: { in: ["paid", "partially_paid"] },
      },
    }),
  ]);
  const totalPurchased = toNumber(purchasedAgg._sum.total ?? 0);
  const lastOrder = customer.orders[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-navy">{customer.name}</h1>
            <Badge
              className={
                customer.status === "active"
                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                  : "bg-red-100 text-red-800 hover:bg-red-100"
              }
            >
              {customer.status === "active" ? "Active" : "Disabled"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Customer since {formatDate(customer.createdAt)}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/customers">Back to Customers</Link>
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-slate-500">Total Orders</p>
            <p className="mt-1 text-2xl font-bold text-navy">{totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-slate-500">
              Total Purchased
            </p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {formatBDT(totalPurchased)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Sum of paid / partially paid orders
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-slate-500">Last Order</p>
            <p className="mt-1 text-2xl font-bold text-navy">
              {lastOrder ? formatDate(lastOrder.createdAt) : "—"}
            </p>
            {lastOrder && (
              <p className="mt-1 text-xs text-slate-400">
                {lastOrder.orderNumber} · {formatBDT(lastOrder.total)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Contact details */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium">{customer.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Phone</dt>
                <dd className="font-medium">{customer.phone}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium">{customer.email ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-medium">
                  {customer.status === "active" ? "Active" : "Disabled"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Account actions */}
        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
            <CardDescription>
              Disable an account to block the customer from logging in. The
              admin can never log in as a customer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CustomerStatusToggle
              customerId={customer.id}
              status={customer.status}
            />
            <PasswordResetLinkButton
              customerId={customer.id}
              customerName={customer.name}
            />
          </CardContent>
        </Card>
      </div>

      {/* Saved addresses */}
      <Card>
        <CardHeader>
          <CardTitle>Saved Addresses</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.addresses.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No saved addresses.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {customer.addresses.map((address) => (
                <div
                  key={address.id}
                  className="rounded-lg border p-4 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-navy">{address.title}</p>
                    {address.isDefault && (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                        Default
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1">
                    {address.fullName} — {address.phone}
                  </p>
                  <p className="text-slate-600">
                    {[
                      address.street,
                      address.area,
                      address.upazila,
                      address.district,
                      address.division,
                      address.postalCode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {address.instructions && (
                    <p className="mt-1 text-xs text-slate-500">
                      {address.instructions}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order history */}
      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
          <CardDescription>Latest 20 orders</CardDescription>
        </CardHeader>
        <CardContent>
          {customer.orders.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No orders yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-primary hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatBDT(order.total)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {PAYMENT_METHOD_LABELS[order.paymentMethod] ??
                          order.paymentMethod}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            PAYMENT_STATUS_BADGE_CLASS[order.paymentStatus] ??
                            "bg-slate-100 text-slate-700 hover:bg-slate-100"
                          }
                        >
                          {PAYMENT_STATUS_LABELS[order.paymentStatus] ??
                            order.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            STATUS_BADGE_CLASS[order.status] ??
                            "bg-slate-100 text-slate-700 hover:bg-slate-100"
                          }
                        >
                          {ORDER_STATUS_LABELS[order.status] ?? order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/orders/${order.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Internal notes */}
      <Card>
        <CardHeader>
          <CardTitle>Internal Notes</CardTitle>
          <CardDescription>Admin-only notes about this customer.</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerNotesForm
            customerId={customer.id}
            initialNotes={customer.notes}
          />
          <p className="mt-2 text-xs text-slate-400">
            Last updated {formatDateTime(customer.updatedAt)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
