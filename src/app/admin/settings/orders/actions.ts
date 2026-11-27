"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { saveOrderSettings } from "@/lib/order-settings";

const boolField = z.enum(["true", "false"]);

const settingsSchema = z.object({
  enableOnlineOrdering: boolField,
  enableGuestCheckout: boolField,
  enableRegistration: boolField,
  enableCustomerLogin: boolField,
  minOrderAmount: z.coerce.number().min(0, "Minimum order amount cannot be negative"),
  enableHomeDelivery: boolField,
  enablePickup: boolField,
  defaultDeliveryFee: z.coerce.number().min(0, "Default delivery fee cannot be negative"),
  freeDeliveryThreshold: z.coerce.number().min(0, "Free delivery threshold cannot be negative"),
  deliveryAreas: z.string().optional(),
  enableCod: boolField,
  enableCashAtShop: boolField,
  enableBkash: boolField,
  enableNagad: boolField,
  enableRocket: boolField,
  bkashNumber: z.string().trim().optional(),
  bkashInstructions: z.string().trim().optional(),
  nagadNumber: z.string().trim().optional(),
  nagadInstructions: z.string().trim().optional(),
  rocketNumber: z.string().trim().optional(),
  rocketInstructions: z.string().trim().optional(),
  estimatedProcessingTime: z.string().trim().optional(),
  estimatedDeliveryTime: z.string().trim().optional(),
  emailNotificationsEnabled: boolField,
  smsNotificationsEnabled: boolField,
  otpEnabled: boolField,
});

const deliveryAreaSchema = z.array(
  z.object({
    area: z.string().trim().min(1, "Each delivery area needs a name"),
    fee: z.number().min(0, "Delivery area fees cannot be negative"),
  })
);

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateOrderSettings(
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  // Delivery areas: JSON array of {area, fee}. An empty textarea means no areas.
  let deliveryAreasJson = "[]";
  const rawAreas = (data.deliveryAreas ?? "").trim();
  if (rawAreas) {
    try {
      const parsedAreas: unknown = JSON.parse(rawAreas);
      const areas = deliveryAreaSchema.parse(parsedAreas);
      deliveryAreasJson = JSON.stringify(areas);
    } catch {
      return {
        ok: false,
        error:
          'Delivery areas must be valid JSON like [{"area": "Chattogram City", "fee": 60}]',
      };
    }
  }

  const values: Record<string, string> = {
    enableOnlineOrdering: data.enableOnlineOrdering,
    enableGuestCheckout: data.enableGuestCheckout,
    enableRegistration: data.enableRegistration,
    enableCustomerLogin: data.enableCustomerLogin,
    minOrderAmount: String(data.minOrderAmount),
    enableHomeDelivery: data.enableHomeDelivery,
    enablePickup: data.enablePickup,
    defaultDeliveryFee: String(data.defaultDeliveryFee),
    freeDeliveryThreshold: String(data.freeDeliveryThreshold),
    deliveryAreas: deliveryAreasJson,
    enableCod: data.enableCod,
    enableCashAtShop: data.enableCashAtShop,
    enableBkash: data.enableBkash,
    enableNagad: data.enableNagad,
    enableRocket: data.enableRocket,
    bkashNumber: data.bkashNumber ?? "",
    bkashInstructions: data.bkashInstructions ?? "",
    nagadNumber: data.nagadNumber ?? "",
    nagadInstructions: data.nagadInstructions ?? "",
    rocketNumber: data.rocketNumber ?? "",
    rocketInstructions: data.rocketInstructions ?? "",
    estimatedProcessingTime: data.estimatedProcessingTime ?? "",
    estimatedDeliveryTime: data.estimatedDeliveryTime ?? "",
    emailNotificationsEnabled: data.emailNotificationsEnabled,
    smsNotificationsEnabled: data.smsNotificationsEnabled,
    otpEnabled: data.otpEnabled,
  };

  await saveOrderSettings(values);
  revalidatePath("/admin/settings/orders");
  revalidatePath("/admin/settings");
  return { ok: true };
}
