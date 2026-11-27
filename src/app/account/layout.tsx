import { requireCustomer } from "@/lib/customer-auth";
import { getSettings } from "@/lib/settings";
import { db as prisma } from "@/lib/db";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";

export const dynamic = "force-dynamic";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireCustomer("/account");
  const settings = await getSettings();
  const categories = await prisma.productCategory.findMany({
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
      <Navbar
        settings={settings}
        categories={categories}
        customer={{ name: session.name }}
      />
      <main className="flex-1 bg-surface">{children}</main>
      <Footer settings={settings} categories={categories} />
    </>
  );
}
