import Link from "next/link";
import { db as prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getOrderSettings } from "@/lib/order-settings";
import { getCustomerSession } from "@/lib/customer-auth";
import { getDbCartWithItems } from "@/lib/cart";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import CheckoutForm, {
  type CheckoutAddress,
  type CheckoutLine,
} from "./CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const settings = await getSettings();
  const orderSettings = await getOrderSettings();
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

  let addresses: CheckoutAddress[] = [];
  let initialItems: CheckoutLine[] = [];
  if (customer) {
    const rows = await prisma.customerAddress.findMany({
      where: { customerId: customer.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    addresses = rows.map((a) => ({
      id: a.id,
      title: a.title,
      fullName: a.fullName,
      phone: a.phone,
      division: a.division,
      district: a.district,
      upazila: a.upazila,
      area: a.area,
      street: a.street,
      postalCode: a.postalCode,
      instructions: a.instructions,
      isDefault: a.isDefault,
    }));
    const items = await getDbCartWithItems(customer.id);
    initialItems = items.map((item) => {
      const discount = item.product.discountPrice;
      const hasDiscount =
        discount !== null && discount > 0 && discount < item.product.price;
      return {
        productId: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        image: item.product.image,
        unitPrice: hasDiscount ? discount : item.product.price,
        originalPrice: item.product.price,
        quantity: item.quantity,
        stock: item.product.stock,
        status: item.product.status,
      } satisfies CheckoutLine;
    });
  }

  const guestCheckoutDisabled = !customer && !orderSettings.enableGuestCheckout;

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
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-navy">Checkout</h1>
          {!orderSettings.enableOnlineOrdering ? (
            <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center">
              <h2 className="text-xl font-bold text-navy">
                Online ordering is currently disabled
              </h2>
              <p className="mt-2 text-slate-500">
                Please contact the shop directly to place your order.
              </p>
              <Link
                href="/products"
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white transition hover:bg-primary-dark"
              >
                Continue Shopping
              </Link>
            </div>
          ) : guestCheckoutDisabled ? (
            <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center">
              <h2 className="text-xl font-bold text-navy">
                Please log in to check out
              </h2>
              <p className="mt-2 text-slate-500">
                Guest checkout is disabled. Log in to your account to place an
                order.
              </p>
              <Link
                href="/login?next=/checkout"
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white transition hover:bg-primary-dark"
              >
                Log In
              </Link>
            </div>
          ) : (
            <div className="mt-8">
              <CheckoutForm
                isLoggedIn={customer !== null}
                customer={customer}
                addresses={addresses}
                initialItems={initialItems}
                settings={{
                  enableHomeDelivery: orderSettings.enableHomeDelivery,
                  enablePickup: orderSettings.enablePickup,
                  defaultDeliveryFee: orderSettings.defaultDeliveryFee,
                  freeDeliveryThreshold: orderSettings.freeDeliveryThreshold,
                  deliveryAreas: orderSettings.deliveryAreas,
                  enableCod: orderSettings.enableCod,
                  enableCashAtShop: orderSettings.enableCashAtShop,
                  enableBkash: orderSettings.enableBkash,
                  enableNagad: orderSettings.enableNagad,
                  enableRocket: orderSettings.enableRocket,
                  bkashNumber: orderSettings.bkashNumber,
                  bkashInstructions: orderSettings.bkashInstructions,
                  nagadNumber: orderSettings.nagadNumber,
                  nagadInstructions: orderSettings.nagadInstructions,
                  rocketNumber: orderSettings.rocketNumber,
                  rocketInstructions: orderSettings.rocketInstructions,
                  estimatedProcessingTime: orderSettings.estimatedProcessingTime,
                  estimatedDeliveryTime: orderSettings.estimatedDeliveryTime,
                }}
                shopAddress={settings.address || "Chattogram, Bangladesh"}
              />
            </div>
          )}
        </div>
      </main>
      <Footer settings={settings} categories={footerCategories} />
    </>
  );
}
