import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Clock,
  KeyRound,
  MapPin,
  Package,
  PackageCheck,
  ShoppingBag,
  Truck,
  User,
} from "lucide-react";
import { requireCustomer } from "@/lib/customer-auth";
import { db } from "@/lib/db";
import { formatBDT, formatDate, formatDateTime } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/orders";
import { markNotificationsRead } from "./actions";

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

const QUICK_LINKS = [
  { label: "View Orders", href: "/account/orders", icon: Package, desc: "See all your orders" },
  { label: "Track Order", href: "/track-order", icon: Truck, desc: "Follow your order status" },
  { label: "Edit Profile", href: "/account/profile", icon: User, desc: "Update name, phone & email" },
  { label: "Manage Addresses", href: "/account/addresses", icon: MapPin, desc: "Saved delivery addresses" },
  { label: "Change Password", href: "/account/profile#change-password", icon: KeyRound, desc: "Keep your account secure" },
];

export default async function AccountDashboardPage() {
  const session = await requireCustomer("/account");

  const [totalOrders, pendingOrders, processingOrders, deliveredOrders, recentOrders, notifications] =
    await Promise.all([
      db.order.count({ where: { customerId: session.id } }),
      db.order.count({
        where: { customerId: session.id, status: "pending" },
      }),
      db.order.count({
        where: { customerId: session.id, status: "processing" },
      }),
      db.order.count({
        where: { customerId: session.id, status: "delivered" },
      }),
      db.order.findMany({
        where: { customerId: session.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          total: true,
          status: true,
          paymentMethod: true,
        },
      }),
      db.notification.findMany({
        where: { customerId: session.id },
        orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
        take: 10,
        select: {
          id: true,
          title: true,
          message: true,
          isRead: true,
          createdAt: true,
          orderId: true,
        },
      }),
    ]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const summaryCards = [
    { label: "Total Orders", value: totalOrders, icon: ShoppingBag },
    { label: "Pending Orders", value: pendingOrders, icon: Clock },
    { label: "Processing Orders", value: processingOrders, icon: Package },
    { label: "Delivered Orders", value: deliveredOrders, icon: PackageCheck },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-navy sm:text-3xl">
        Welcome back, {session.name}
      </h1>
      <p className="mt-1 text-slate-600">
        Here is a quick look at your orders and updates from Kazi Gift and
        Print House.
      </p>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <card.icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-navy">{card.value}</p>
            <p className="text-sm text-slate-600">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent orders */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-navy">Recent Orders</h2>
            <Link
              href="/account/orders"
              className="text-sm font-semibold text-primary hover:text-primary-dark"
            >
              View all →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm text-slate-600">
                You have not placed any orders yet.
              </p>
              <Link
                href="/products"
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
              >
                Browse Products
              </Link>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {recentOrders.map((order) => (
                <li key={order.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-navy">
                        {order.orderNumber}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {formatDate(order.createdAt)} ·{" "}
                        {PAYMENT_METHOD_LABELS[order.paymentMethod] ??
                          order.paymentMethod}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-sm font-bold text-navy">
                        {formatBDT(order.total)}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_BADGE[order.status] ??
                          "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Quick links */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-navy">Quick Links</h2>
          <ul className="mt-4 space-y-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 transition hover:border-primary/30 hover:bg-primary/5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <link.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-navy">
                      {link.label}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {link.desc}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Notifications */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
                {unreadCount} new
              </span>
            )}
          </h2>
          {unreadCount > 0 && (
            <form action={markNotificationsRead}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy transition hover:bg-slate-100"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark all as read
              </button>
            </form>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No notifications yet. Updates about your orders will appear here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {notifications.map((n) => (
              <li key={n.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                    n.isRead ? "bg-slate-300" : "bg-primary"
                  }`}
                  aria-label={n.isRead ? "Read" : "Unread"}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy">{n.title}</p>
                  <p className="text-sm text-slate-600">{n.message}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatDateTime(n.createdAt)}
                    {n.orderId && (
                      <>
                        {" · "}
                        <Link
                          href={`/account/orders/${n.orderId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          View order
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
