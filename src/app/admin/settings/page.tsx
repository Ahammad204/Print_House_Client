import { db as prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();
  const [settings, products, categories] = await Promise.all([
    getSettings(),
    prisma.product.findMany({
      select: { id: true, name: true, featured: true },
      orderBy: { name: "asc" },
    }),
    prisma.productCategory.findMany({
      select: { id: true, name: true, status: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Website Settings</h1>
        <p className="text-sm text-slate-500">
          Shop details, homepage content, appearance and SEO. Changes apply
          to the public site immediately.
        </p>
      </div>
      <SettingsForm
        settings={settings}
        products={products}
        categories={categories}
      />
    </div>
  );
}
