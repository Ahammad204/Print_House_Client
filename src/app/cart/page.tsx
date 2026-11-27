import { db as prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getOrderSettings } from "@/lib/order-settings";
import { getCustomerSession } from "@/lib/customer-auth";
import { getDbCartWithItems } from "@/lib/cart";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import CartClient, { type CartLine } from "./CartClient";

export const dynamic = "force-dynamic";

export default async function CartPage() {
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

  let initialItems: CartLine[] = [];
  if (customer) {
    const items = await getDbCartWithItems(customer.id);
    initialItems = items.map((item) => {
      const discount = item.product.discountPrice;
      const hasDiscount =
        discount !== null && discount > 0 && discount < item.product.price;
      return {
        key: item.id,
        itemId: item.id,
        productId: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        image: item.product.image,
        unitPrice: hasDiscount ? discount : item.product.price,
        originalPrice: item.product.price,
        stock: item.product.stock,
        status: item.product.status,
        quantity: item.quantity,
      } satisfies CartLine;
    });
  }

  return (
    <>
      {/* Navbar contract: { settings, categories?, customer? }. The customer
          prop is passed via spread until the Navbar type gains it — see the
          coordinator note; the runtime prop itself is already honoured. */}
      <Navbar
        {...{
          settings,
          categories: footerCategories,
          customer: customer ? { name: customer.name } : null,
        }}
      />
      <main className="flex-1 bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-navy">Your Cart</h1>
          <p className="mt-2 text-slate-500">
            Review your items before checkout. Prices are confirmed from the
            shop when you place your order.
          </p>
          <div className="mt-8">
            <CartClient
              isLoggedIn={customer !== null}
              initialItems={initialItems}
              defaultDeliveryFee={orderSettings.defaultDeliveryFee}
              freeDeliveryThreshold={orderSettings.freeDeliveryThreshold}
            />
          </div>
        </div>
      </main>
      <Footer settings={settings} categories={footerCategories} />
    </>
  );
}
