import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CheckCircle2, MessageCircle, Package, ShieldCheck } from "lucide-react";
import { db as prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getCustomerSession } from "@/lib/customer-auth";
import {
  ORDER_SUCCESS_COOKIE,
  verifyOrderSuccessToken,
} from "@/lib/auth";
import {
  getOrderByNumber,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDeliveryAddress,
} from "@/lib/orders";
import { formatBDT, formatDateTime } from "@/lib/utils";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import InvoiceButtons from "@/components/orders/InvoiceButtons";
import PhoneVerifyForm from "./PhoneVerifyForm";
import type { InvoiceOrder, InvoiceShop } from "@/lib/invoice-pdf";

export const dynamic = "force-dynamic";

function maskPhone(phone: string): string {
  if (phone.length <= 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

/** Mask an email to first character + domain, e.g. a***@example.com. */
function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

/**
 * Order-success page (audit H2).
 *
 * The order number alone is NOT proof of ownership — order numbers are
 * sequential (KGP-YYYYMMDD-NNNN) and trivially enumerable. The full order
 * (name, email, address, items, totals) is shown only when:
 *  (a) a logged-in customer session owns the order, or
 *  (b) the visitor supplies the phone number used at checkout, verified
 *      exactly like /track-order does (normalizeBdPhone +
 *      getOrderByNumberForGuest, rate-limited per IP, one generic error).
 *      The phone is POSTed via the verifyOrderPhone server action, which
 *      sets a short-lived signed cookie scoped to this order's page —
 *      the phone itself never appears in the URL, history, or logs.
 * Anyone else sees only a masked summary: masked email and at most the
 * district/upazila — never the full street address, phone, or email.
 *
 * Guests are NOT forced to log in: a guest who just placed an order lands
 * here from checkout and unlocks the full view by entering the phone
 * number they checked out with.
 */
export default async function OrderSuccessPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  let order;
  try {
    order = await getOrderByNumber(orderNumber);
  } catch {
    // Database unreachable — show the not-found page instead of erroring.
    notFound();
  }
  if (!order) notFound();

  const settings = await getSettings();
  const customer = await getCustomerSession();
  const footerCategories = await prisma.productCategory.findMany({
    where: { status: "active" },
    orderBy: { order: "asc" },
    include: {
      _count: {
        select: { products: { where: { status: { not: "hidden" } } } },
      },
    },
  });

  // (a) Logged-in owner: the session's customer id matches the order.
  const isOwner =
    !!customer && !!order.customerId && order.customerId === customer.id;

  // (b) Otherwise, a valid signed verification cookie for this order —
  // set by the verifyOrderPhone server action after the visitor proved
  // ownership with the checkout phone number.
  let verified = isOwner;
  if (!verified) {
    const cookieStore = await cookies();
    const token = cookieStore.get(ORDER_SUCCESS_COOKIE)?.value;
    if (token) {
      verified = await verifyOrderSuccessToken(token, order.orderNumber);
    }
  }

  const whatsappDigits = (settings.whatsapp || "").replace(/\D/g, "");
  const whatsappText = encodeURIComponent(
    `Hello, I have a question about my order ${order.orderNumber} from Kazi Gift and Print House.`,
  );
  const whatsappUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${whatsappText}`
    : null;

  // (c) Not the owner and no matching phone: masked summary only.
  if (!verified) {
    const maskedEmail = maskEmail(order.customerEmail);
    const deliveryArea =
      order.deliveryMethod === "pickup"
        ? "Shop Pickup"
        : [order.upazila, order.district].filter(Boolean).join(", ");
    return (
      <>
        {/* Navbar contract: { settings, categories?, customer? } — see cart page note. */}
        <Navbar
          {...{
            settings,
            categories: footerCategories,
            customer: customer ? { name: customer.name } : null,
          }}
        />
        <main className="flex-1 bg-surface">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center sm:p-8">
              <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
              <h1 className="mt-4 text-2xl font-bold text-navy sm:text-3xl">
                Thank you! Your order has been placed.
              </h1>
              <p className="mt-2 text-slate-500">
                We have received your order and will start preparing it soon.
              </p>
              <p className="mt-4 text-sm text-slate-500">Order number</p>
              <p className="text-2xl font-bold tracking-wide text-navy">
                {order.orderNumber}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Placed on {formatDateTime(order.createdAt)}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                <Package className="h-4 w-4" />
                {ORDER_STATUS_LABELS[order.status] ?? order.status}
              </span>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-bold text-navy">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Confirm it&rsquo;s your order
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                For your privacy, the full order details are hidden. Enter the
                phone number you used at checkout to view your order.
              </p>
              <PhoneVerifyForm orderNumber={order.orderNumber} />
              <dl className="mt-5 space-y-1 border-t border-slate-200 pt-4 text-sm">
                {maskedEmail && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">Email</dt>
                    <dd className="text-navy">{maskedEmail}</dd>
                  </div>
                )}
                {deliveryArea && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">Delivery area</dt>
                    <dd className="text-navy">{deliveryArea}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-4 text-xs text-slate-500">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Log in
                </Link>{" "}
                to see your orders, or use{" "}
                <Link
                  href="/track-order"
                  className="font-semibold text-primary hover:underline"
                >
                  Track Order
                </Link>
                .
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/track-order"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
              >
                Track Order
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </main>
        <Footer settings={settings} categories={footerCategories} />
      </>
    );
  }

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
  const shop: InvoiceShop = {
    shopName: settings.shopName || "Kazi Gift and Print House",
    phone: settings.phone || "",
    email: settings.email || "",
    address: settings.address || "",
  };

  // One shared formatter (see lib/orders.ts) so this page shows exactly
  // the same full address as tracking, admin and the invoice.
  const deliveryAddress = formatDeliveryAddress(order);

  return (
    <>
      {/* Navbar contract: { settings, categories?, customer? } — see cart page note. */}
      <Navbar
        {...{
          settings,
          categories: footerCategories,
          customer: customer ? { name: customer.name } : null,
        }}
      />
      <main className="flex-1 bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center sm:p-8">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
            <h1 className="mt-4 text-2xl font-bold text-navy sm:text-3xl">
              Thank you! Your order has been placed.
            </h1>
            <p className="mt-2 text-slate-500">
              We have received your order and will start preparing it soon.
            </p>
            <p className="mt-4 text-sm text-slate-500">Order number</p>
            <p className="text-2xl font-bold tracking-wide text-navy">
              {order.orderNumber}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Placed on {formatDateTime(order.createdAt)}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              <Package className="h-4 w-4" />
              {ORDER_STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-bold text-navy">Customer</h2>
              <p className="mt-2 text-sm text-slate-600">{order.customerName}</p>
              <p className="text-sm text-slate-600">{maskPhone(order.customerPhone)}</p>
              {order.customerEmail && (
                <p className="text-sm text-slate-600">{order.customerEmail}</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-bold text-navy">Delivery</h2>
              <p className="mt-2 text-sm text-slate-600">
                {order.deliveryMethod === "pickup" ? "Shop Pickup" : "Home Delivery"}
              </p>
              {order.deliveryMethod !== "pickup" && (
                <p className="text-sm break-words text-slate-600">{deliveryAddress}</p>
              )}
              <p className="text-sm text-slate-600">
                {order.deliveryName} — {maskPhone(order.deliveryPhone)}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold text-navy">Items</h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="text-slate-600">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-medium text-navy">
                    {formatBDT(item.total)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Subtotal</dt>
                <dd className="text-navy">{formatBDT(order.subtotal)}</dd>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-600">Discount</dt>
                  <dd className="text-green-700">-{formatBDT(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-600">Delivery fee</dt>
                <dd className="text-navy">{formatBDT(order.deliveryFee)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-navy">
                <dt>Total</dt>
                <dd>{formatBDT(order.total)}</dd>
              </div>
              <div className="flex justify-between pt-1">
                <dt className="text-slate-600">Payment</dt>
                <dd className="text-navy">
                  {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod} (
                  {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus})
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/track-order"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Track Order
            </Link>
            {order.customerId && (
              <Link
                href={`/account/orders/${order.id}`}
                className="inline-flex items-center justify-center rounded-lg border border-primary px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
              >
                View in My Orders
              </Link>
            )}
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Continue Shopping
            </Link>
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                <MessageCircle className="h-4 w-4" />
                Contact on WhatsApp
              </a>
            )}
            <InvoiceButtons order={invoiceOrder} shop={shop} />
          </div>
        </div>
      </main>
      <Footer settings={settings} categories={footerCategories} />
    </>
  );
}
