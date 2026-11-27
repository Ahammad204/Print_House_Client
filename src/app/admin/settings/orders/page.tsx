import { requireAdmin } from "@/lib/auth";
import { getOrderSettings } from "@/lib/order-settings";
import OrderSettingsForm from "./OrderSettingsForm";

export const dynamic = "force-dynamic";

export default async function OrderSettingsPage() {
  await requireAdmin();
  const settings = await getOrderSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Order Settings</h1>
        <p className="text-sm text-slate-500">
          Ordering features, delivery fees and areas, payment methods and
          numbers, and notification preferences. Changes apply to checkout
          immediately.
        </p>
      </div>
      <OrderSettingsForm settings={settings} />
    </div>
  );
}
