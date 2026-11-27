"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createPasswordResetToken } from "@/lib/customer-auth";

type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateCustomer(customerId: string) {
  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
}

/** Update the admin-only internal notes for a customer. */
export async function updateCustomerNotes(
  customerId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const notes = String(formData.get("notes") ?? "").trim();
  try {
    const existing = await db.customer.findUnique({
      where: { id: customerId },
    });
    if (!existing) return { ok: false, error: "Customer not found." };
    await db.customer.update({
      where: { id: customerId },
      data: { notes: notes || null },
    });
    revalidateCustomer(customerId);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save the notes." };
  }
}

/** Toggle a customer between active and disabled. Disabled customers cannot log in. */
export async function toggleCustomerStatus(
  customerId: string
): Promise<ActionResult> {
  await requireAdmin();
  try {
    const existing = await db.customer.findUnique({
      where: { id: customerId },
    });
    if (!existing) return { ok: false, error: "Customer not found." };
    await db.customer.update({
      where: { id: customerId },
      data: { status: existing.status === "active" ? "disabled" : "active" },
    });
    revalidateCustomer(customerId);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update the customer status." };
  }
}

export type ResetLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Generate a one-time password reset link for the customer. The raw token
 * is returned ONCE — the admin must share it privately with the customer.
 * The link expires after 1 hour and can be used only once. No password
 * hash is ever exposed.
 */
export async function generatePasswordResetLink(
  customerId: string
): Promise<ResetLinkResult> {
  await requireAdmin();
  try {
    const existing = await db.customer.findUnique({
      where: { id: customerId },
    });
    if (!existing) return { ok: false, error: "Customer not found." };
    const rawToken = await createPasswordResetToken(customerId);
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    return {
      ok: true,
      url: `${siteUrl.replace(/\/$/, "")}/reset-password?token=${rawToken}`,
    };
  } catch {
    return { ok: false, error: "Could not generate a reset link." };
  }
}
