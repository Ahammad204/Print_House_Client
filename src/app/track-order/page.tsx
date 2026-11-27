import { db as prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getCustomerSession } from "@/lib/customer-auth";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import TrackOrderClient from "./TrackOrderClient";

export const dynamic = "force-dynamic";

export default async function TrackOrderPage() {
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
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-navy">Track Your Order</h1>
          <p className="mt-2 text-slate-500">
            Enter your order number and the phone number used for the order to
            see its current status.
          </p>
          <div className="mt-8">
            <TrackOrderClient />
          </div>
        </div>
      </main>
      <Footer settings={settings} categories={footerCategories} />
    </>
  );
}
