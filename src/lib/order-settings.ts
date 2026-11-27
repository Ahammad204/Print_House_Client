import { db } from "@/lib/db";

/**
 * Order settings live in the existing WebsiteSetting key/value store
 * (keys prefixed `order.`), so they persist in the database and are managed
 * from /admin/settings/orders — no separate settings table needed.
 *
 * Delivery fees, payment numbers and feature flags are NEVER hardcoded in
 * checkout code; they always come from here.
 */
export type DeliveryArea = { area: string; fee: number };

export type OrderSettings = {
  enableOnlineOrdering: boolean;
  enableGuestCheckout: boolean;
  enableRegistration: boolean;
  enableCustomerLogin: boolean;
  minOrderAmount: number;
  enableHomeDelivery: boolean;
  enablePickup: boolean;
  defaultDeliveryFee: number;
  freeDeliveryThreshold: number;
  deliveryAreas: DeliveryArea[];
  enableCod: boolean;
  enableCashAtShop: boolean;
  enableBkash: boolean;
  enableNagad: boolean;
  enableRocket: boolean;
  bkashNumber: string;
  bkashInstructions: string;
  nagadNumber: string;
  nagadInstructions: string;
  rocketNumber: string;
  rocketInstructions: string;
  estimatedProcessingTime: string;
  estimatedDeliveryTime: string;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  otpEnabled: boolean;
};

export const DEFAULT_ORDER_SETTINGS: OrderSettings = {
  enableOnlineOrdering: true,
  enableGuestCheckout: true,
  enableRegistration: true,
  enableCustomerLogin: true,
  minOrderAmount: 0,
  enableHomeDelivery: true,
  enablePickup: true,
  defaultDeliveryFee: 60,
  freeDeliveryThreshold: 0,
  deliveryAreas: [],
  enableCod: true,
  enableCashAtShop: true,
  enableBkash: true,
  enableNagad: true,
  enableRocket: true,
  bkashNumber: "",
  bkashInstructions: "",
  nagadNumber: "",
  nagadInstructions: "",
  rocketNumber: "",
  rocketInstructions: "",
  estimatedProcessingTime: "1-2 days",
  estimatedDeliveryTime: "2-3 days",
  emailNotificationsEnabled: false,
  smsNotificationsEnabled: false,
  otpEnabled: false,
};

const KEY_PREFIX = "order.";

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  return raw === "true";
}

function parseNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseAreas(raw: string | undefined): DeliveryArea[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (a): a is DeliveryArea =>
          typeof a === "object" &&
          a !== null &&
          typeof (a as DeliveryArea).area === "string" &&
          typeof (a as DeliveryArea).fee === "number",
      )
      .map((a) => ({ area: a.area.trim(), fee: Math.max(0, a.fee) }))
      .filter((a) => a.area.length > 0);
  } catch {
    return [];
  }
}

export async function getOrderSettings(): Promise<OrderSettings> {
  try {
    const rows = await db.websiteSetting.findMany({
      where: { key: { startsWith: KEY_PREFIX } },
    });
    const map = new Map(rows.map((r) => [r.key.slice(KEY_PREFIX.length), r.value]));
    const d = DEFAULT_ORDER_SETTINGS;
    return {
      enableOnlineOrdering: parseBool(map.get("enableOnlineOrdering"), d.enableOnlineOrdering),
      enableGuestCheckout: parseBool(map.get("enableGuestCheckout"), d.enableGuestCheckout),
      enableRegistration: parseBool(map.get("enableRegistration"), d.enableRegistration),
      enableCustomerLogin: parseBool(map.get("enableCustomerLogin"), d.enableCustomerLogin),
      minOrderAmount: parseNumber(map.get("minOrderAmount"), d.minOrderAmount),
      enableHomeDelivery: parseBool(map.get("enableHomeDelivery"), d.enableHomeDelivery),
      enablePickup: parseBool(map.get("enablePickup"), d.enablePickup),
      defaultDeliveryFee: parseNumber(map.get("defaultDeliveryFee"), d.defaultDeliveryFee),
      freeDeliveryThreshold: parseNumber(map.get("freeDeliveryThreshold"), d.freeDeliveryThreshold),
      deliveryAreas: parseAreas(map.get("deliveryAreas")),
      enableCod: parseBool(map.get("enableCod"), d.enableCod),
      enableCashAtShop: parseBool(map.get("enableCashAtShop"), d.enableCashAtShop),
      enableBkash: parseBool(map.get("enableBkash"), d.enableBkash),
      enableNagad: parseBool(map.get("enableNagad"), d.enableNagad),
      enableRocket: parseBool(map.get("enableRocket"), d.enableRocket),
      bkashNumber: map.get("bkashNumber") ?? d.bkashNumber,
      bkashInstructions: map.get("bkashInstructions") ?? d.bkashInstructions,
      nagadNumber: map.get("nagadNumber") ?? d.nagadNumber,
      nagadInstructions: map.get("nagadInstructions") ?? d.nagadInstructions,
      rocketNumber: map.get("rocketNumber") ?? d.rocketNumber,
      rocketInstructions: map.get("rocketInstructions") ?? d.rocketInstructions,
      estimatedProcessingTime: map.get("estimatedProcessingTime") ?? d.estimatedProcessingTime,
      estimatedDeliveryTime: map.get("estimatedDeliveryTime") ?? d.estimatedDeliveryTime,
      emailNotificationsEnabled: parseBool(map.get("emailNotificationsEnabled"), d.emailNotificationsEnabled),
      smsNotificationsEnabled: parseBool(map.get("smsNotificationsEnabled"), d.smsNotificationsEnabled),
      otpEnabled: parseBool(map.get("otpEnabled"), d.otpEnabled),
    };
  } catch {
    return { ...DEFAULT_ORDER_SETTINGS };
  }
}

/** Persist order settings (admin only — callers must check admin session). */
export async function saveOrderSettings(
  values: Partial<Record<string, string>>,
): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    await db.websiteSetting.upsert({
      where: { key: `${KEY_PREFIX}${key}` },
      update: { value },
      create: { key: `${KEY_PREFIX}${key}`, value },
    });
  }
}
