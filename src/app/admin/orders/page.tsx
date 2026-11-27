import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db as prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  dhakaDayRange,
  dhakaTodayRange,
  formatBDT,
  formatDate,
  toNumber,
} from "@/lib/utils";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const PAYMENT_STATUSES = [
  "unpaid",
  "pending_verification",
  "partially_paid",
  "paid",
  "refunded",
  "partially_refunded",
] as const;

const DELIVERY_METHODS = ["home", "pickup"] as const;

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

type SearchParams = {
  q?: string;
  date?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  deliveryMethod?: string;
  page?: string;
};

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

function parseDateParam(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildPageHref(base: SearchParams, page: number): string {
  const params = new URLSearchParams();
  if (base.q) params.set("q", base.q);
  if (base.date) params.set("date", base.date);
  if (base.status) params.set("status", base.status);
  if (base.paymentStatus) params.set("paymentStatus", base.paymentStatus);
  if (base.paymentMethod) params.set("paymentMethod", base.paymentMethod);
  if (base.deliveryMethod) params.set("deliveryMethod", base.deliveryMethod);
  params.set("page", String(page));
  return `/admin/orders?${params.toString()}`;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = (ORDER_STATUSES as readonly string[]).includes(sp.status ?? "")
    ? sp.status!
    : "";
  const paymentStatus = (PAYMENT_STATUSES as readonly string[]).includes(
    sp.paymentStatus ?? ""
  )
    ? sp.paymentStatus!
    : "";
  const paymentMethod = (PAYMENT_METHODS as readonly string[]).includes(
    sp.paymentMethod ?? ""
  )
    ? sp.paymentMethod!
    : "";
  const deliveryMethod = (DELIVERY_METHODS as readonly string[]).includes(
    sp.deliveryMethod ?? ""
  )
    ? sp.deliveryMethod!
    : "";
  const dateParam = parseDateParam(sp.date);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.OrderWhereInput = {};
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (paymentMethod) where.paymentMethod = paymentMethod;
  if (deliveryMethod) where.deliveryMethod = deliveryMethod;
  if (dateParam) {
    const range = dhakaDayRange(dateParam);
    where.createdAt = { gte: range.start, lte: range.end };
  }

  const today = dhakaTodayRange();

  const [
    orders,
    totalCount,
    statusCounts,
    todayCount,
    todayValueAgg,
    paidCount,
  ] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.order.count({
      where: { createdAt: { gte: today.start, lte: today.end } },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        createdAt: { gte: today.start, lte: today.end },
        status: { not: "cancelled" },
      },
    }),
    prisma.order.count({ where: { paymentStatus: "paid" } }),
  ]);

  const countByStatus = new Map(
    statusCounts.map((c) => [c.status, c._count._all])
  );
  const countFor = (s: string) => countByStatus.get(s) ?? 0;
  const todayValue = toNumber(todayValueAgg._sum.total ?? 0);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const filterState: SearchParams = {
    q: q || undefined,
    date: sp.date,
    status: status || undefined,
    paymentStatus: paymentStatus || undefined,
    paymentMethod: paymentMethod || undefined,
    deliveryMethod: deliveryMethod || undefined,
  };

  const summaryCards: { label: string; value: string; valueClass?: string }[] = [
    { label: "Orders Today", value: String(todayCount) },
    { label: "Pending Orders", value: String(countFor("pending")) },
    { label: "Confirmed Orders", value: String(countFor("confirmed")) },
    { label: "Processing Orders", value: String(countFor("processing")) },
    { label: "Ready for Pickup", value: String(countFor("ready")) },
    { label: "Shipped Orders", value: String(countFor("shipped")) },
    { label: "Delivered Orders", value: String(countFor("delivered")) },
    {
      label: "Cancelled Orders",
      value: String(countFor("cancelled")),
      valueClass: "text-red-600",
    },
    {
      label: "Today's Order Value",
      value: formatBDT(todayValue),
      valueClass: "text-green-600",
    },
    { label: "Total Paid Orders", value: String(paidCount) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Orders</h1>
        <p className="text-sm text-slate-500">
          Manage online orders — confirm, track, verify payments and cancel.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-5">
              <p className="text-xs font-medium text-slate-500 sm:text-sm">
                {card.label}
              </p>
              <p
                className={cn(
                  "mt-1 truncate text-xl font-bold text-navy",
                  card.valueClass
                )}
              >
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form
            method="get"
            action="/admin/orders"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <Input
              type="search"
              name="q"
              placeholder="Search order no., customer or phone..."
              defaultValue={q}
            />
            <div className="flex items-center gap-2">
              <label htmlFor="date" className="shrink-0 text-sm text-slate-500">
                Date
              </label>
              <Input
                id="date"
                type="date"
                name="date"
                defaultValue={sp.date ?? ""}
              />
            </div>
            <select name="status" defaultValue={status} className={selectClass}>
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS[s] ?? s}
                </option>
              ))}
            </select>
            <select
              name="paymentStatus"
              defaultValue={paymentStatus}
              className={selectClass}
            >
              <option value="">All payment statuses</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PAYMENT_STATUS_LABELS[s] ?? s}
                </option>
              ))}
            </select>
            <select
              name="paymentMethod"
              defaultValue={paymentMethod}
              className={selectClass}
            >
              <option value="">All payment methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m] ?? m}
                </option>
              ))}
            </select>
            <select
              name="deliveryMethod"
              defaultValue={deliveryMethod}
              className={selectClass}
            >
              <option value="">All delivery methods</option>
              <option value="home">Home Delivery</option>
              <option value="pickup">Shop Pickup</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit">Filter</Button>
              <Button variant="outline" asChild>
                <Link href="/admin/orders">Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No orders found for the selected filters.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Order Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="text-primary hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="whitespace-nowrap">{order.customerName}</div>
                          <div className="text-xs text-slate-500">
                            {order.customerPhone}
                          </div>
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

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page {currentPage} of {totalPages} ({totalCount} order
                    {totalCount === 1 ? "" : "s"})
                  </p>
                  <div className="flex gap-2">
                    {currentPage > 1 && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={buildPageHref(filterState, currentPage - 1)}>
                          Previous
                        </Link>
                      </Button>
                    )}
                    {currentPage < totalPages && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={buildPageHref(filterState, currentPage + 1)}>
                          Next
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
