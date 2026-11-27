"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db as prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const SETTING_KEYS = [
  "shopName",
  "tagline",
  "phone",
  "whatsapp",
  "email",
  "address",
  "mapsUrl",
  "facebook",
  "instagram",
  "openingHours",
  "heroTitle",
  "heroDescription",
  "heroImage",
  "aboutTitle",
  "aboutText",
  "services",
  "featuredProductIds",
  "featuredCategoryIds",
  "primaryColor",
  "accentColor",
  "seoTitle",
  "seoDescription",
  "ogImage",
  "logo",
  "favicon",
] as const;

const URL_KEYS = [
  "mapsUrl",
  "facebook",
  "instagram",
  "heroImage",
  "ogImage",
  "logo",
  "favicon",
] as const;

const settingsSchema = z.object(
  Object.fromEntries(SETTING_KEYS.map((k) => [k, z.string().trim().optional()]))
);

type ActionResult = { success: true } | { success: false; error: string };

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function updateSettings(
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data as Record<string, string | undefined>;

  // WhatsApp: digits only.
  const whatsapp = data.whatsapp ?? "";
  if (whatsapp && !/^\d+$/.test(whatsapp)) {
    return {
      success: false,
      error: "WhatsApp number must contain digits only, e.g. 8801812345678",
    };
  }

  // URLs must be valid URLs or empty. Uploaded paths (/uploads/...) are
  // relative, so they are accepted as-is.
  for (const key of URL_KEYS) {
    const value = data[key] ?? "";
    if (value && !value.startsWith("/") && !isValidUrl(value)) {
      return { success: false, error: `${key} must be a valid URL` };
    }
  }

  // Email, when provided, must look like an email address.
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { success: false, error: "Email address is invalid" };
  }

  // Services must be valid JSON (an array of {title, description, icon}).
  if (data.services) {
    try {
      const services = JSON.parse(data.services);
      if (!Array.isArray(services)) throw new Error("not an array");
      for (const s of services) {
        if (typeof s?.title !== "string" || typeof s?.description !== "string") {
          throw new Error("bad entry");
        }
      }
    } catch {
      return { success: false, error: "Services data is invalid" };
    }
  }

  // Colours must be hex values when provided.
  for (const key of ["primaryColor", "accentColor"] as const) {
    const value = data[key] ?? "";
    if (value && !/^#[0-9a-fA-F]{6}$/.test(value)) {
      return { success: false, error: `${key} must be a hex colour, e.g. #2563EB` };
    }
  }

  for (const key of SETTING_KEYS) {
    const value = data[key];
    if (value === undefined) continue;
    await prisma.websiteSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidatePath("/products");
  return { success: true };
}
