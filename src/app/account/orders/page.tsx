import Link from "next/link";
import { Package, Search, Truck } from "lucide-react";
import { requireCustomer } from "@/lib/customer-auth";
import { db } from "@/lib/db";
import { formatBDT, formatDate } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/orders";

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

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function CustomerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireCustomer("/account/orders");
  const params = await searchParams;
  const statusFilter = first(params.status).trim() || "all";
  const q = first(params.q).trim();

  // "Completed" means delivered.
  const statusValue =
    statusFilter === "completed"
      ? "delivered"
      : ["pending", "confirmed", "processing", "cancelled"].includes(statusFilter)
        ? statusFilter
        : undefined;

  const orders = await db.order.findMany({
    where: {
      customerId: session.id,
      ...(statusValue ? { status: statusValue } : {}),
      ...(q
        ? { orderNumber: { contains: q, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      total: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
    },
  });

  function filterHref(value: string): string {
    const sp = new URLSearchParams();
    if (value !== "all") sp.set("status", value);
    if (q) sp.set("q", q);
    const query = sp.toString();
    return query ? `/account/orders?${query}` : "/account/orders";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-navy sm:text-3xl">My Orders</h1>
      <p className="mt-1 text-slate-600">
        All of your orders, newest first.
      </p>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const active = statusFilter === filter.value;
            return (
              <Link
                key={filter.value}
                href={filterHref(filter.value)}
                aria-current={active ? "true" : undefined}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-primary text-white"
                    : "border border-slate-300 bg-white text-navy hover:bg-slate-100"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
        <form
          method="get"
          action="/account/orders"
          className="flex w-full gap-2 lg:w-80"
        >
          {statusFilter !== "all" && (
            <input type="hidden" name="status" value={statusFilter} />
          )}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by order number…"
              aria-label="Search by order number"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            Search
          </button>
        </form>
      </div>

      {orders.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <Package className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-3 text-lg font-bold text-navy">No orders found</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            {q || statusFilter !== "all"
              ? "No orders match your filters. Try a different search or filter."
              : "You have not placed any orders yet."}
          </p>
          {!(q || statusFilter !== "all") && (
            <Link
              href="/products"
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Browse Products
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => (
            <article
              key={order.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-navy">
                    {order.orderNumber}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {formatDate(order.createdAt)}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    STATUS_BADGE[order.status] ?? "bg-slate-100 text-slate-700"
                  }`}
                >
                  {ORDER_STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-slate-500">Total</dt>
                  <dd className="font-bold text-navy">{formatBDT(order.total)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-slate-500">Payment</dt>
                  <dd className="font-medium text-navy">
                    {PAYMENT_METHOD_LABELS[order.paymentMethod] ??
                      order.paymentMethod}{" "}
                    <span className="text-slate-500">
                      ({PAYMENT_STATUS_LABELS[order.paymentStatus] ??
                        order.paymentStatus})
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-medium text-navy">
                    {ORDER_STATUS_LABELS[order.status] ?? order.status}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/account/orders/${order.id}`}
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
                >
                  View Details
                </Link>
                <Link
                  href={`/track-order`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-navy transition hover:bg-slate-100"
                >
                  <Truck className="h-4 w-4" />
                  Track
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
