"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-auth";
import { isValidBdPhone, normalizeBdPhone } from "@/lib/validation";

export type AddressData = {
  id: string;
  title: string;
  fullName: string;
  phone: string;
  division: string;
  district: string;
  upazila: string;
  area: string;
  street: string;
  postalCode: string | null;
  instructions: string | null;
  isDefault: boolean;
};

export type AddressFormState = {
  error?: string;
  ok?: boolean;
  message?: string;
} | null;

const addressSchema = z.object({
  title: z.string().trim().min(1, "Give this address a title (e.g. Home)."),
  fullName: z.string().trim().min(2, "Enter the recipient's full name."),
  phone: z.string().trim().min(1, "Phone number is required."),
  division: z.string().trim().min(1, "Division is required."),
  district: z.string().trim().min(1, "District is required."),
  upazila: z.string().trim().min(1, "Upazila is required."),
  area: z.string().trim().min(1, "Area is required."),
  street: z.string().trim().min(1, "Street / house details are required."),
  postalCode: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
});

function addressInput(formData: FormData) {
  return {
    title: formData.get("title"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    division: formData.get("division"),
    district: formData.get("district"),
    upazila: formData.get("upazila"),
    area: formData.get("area"),
    street: formData.get("street"),
    postalCode: formData.get("postalCode") || undefined,
    instructions: formData.get("instructions") || undefined,
  };
}

async function requireSessionId(): Promise<string | null> {
  const session = await getCustomerSession();
  return session?.id ?? null;
}

/** Read by the addresses page to list the customer's addresses. */
export async function listAddresses(): Promise<AddressData[]> {
  const customerId = await requireSessionId();
  if (!customerId) return [];
  const rows = await db.customerAddress.findMany({
    where: { customerId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return rows.map((a) => ({
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
}

export async function addAddress(
  _prevState: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const customerId = await requireSessionId();
  if (!customerId) return { error: "Your session has expired. Please log in again." };

  const parsed = addressSchema.safeParse(addressInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  if (!isValidBdPhone(parsed.data.phone)) {
    return { error: "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)." };
  }
  const phone = normalizeBdPhone(parsed.data.phone) as string;
  const wantDefault = formData.get("isDefault") === "on";
  const data = {
    title: parsed.data.title,
    fullName: parsed.data.fullName,
    phone,
    division: parsed.data.division,
    district: parsed.data.district,
    upazila: parsed.data.upazila,
    area: parsed.data.area,
    street: parsed.data.street,
    postalCode: parsed.data.postalCode || null,
    instructions: parsed.data.instructions || null,
  };

  await db.$transaction(async (tx) => {
    const existingCount = await tx.customerAddress.count({
      where: { customerId },
    });
    const isDefault = wantDefault || existingCount === 0;
    if (isDefault) {
      await tx.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }
    await tx.customerAddress.create({
      data: { ...data, customerId, isDefault },
    });
  });

  revalidatePath("/account/addresses");
  return { ok: true, message: "Address added." };
}

export async function updateAddress(
  _prevState: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const customerId = await requireSessionId();
  if (!customerId) return { error: "Your session has expired. Please log in again." };

  const id = String(formData.get("id") ?? "");
  const parsed = addressSchema.safeParse(addressInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  if (!isValidBdPhone(parsed.data.phone)) {
    return { error: "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)." };
  }
  const phone = normalizeBdPhone(parsed.data.phone) as string;
  const wantDefault = formData.get("isDefault") === "on";
  const data = {
    title: parsed.data.title,
    fullName: parsed.data.fullName,
    phone,
    division: parsed.data.division,
    district: parsed.data.district,
    upazila: parsed.data.upazila,
    area: parsed.data.area,
    street: parsed.data.street,
    postalCode: parsed.data.postalCode || null,
    instructions: parsed.data.instructions || null,
  };

  const existing = await db.customerAddress.findFirst({
    where: { id, customerId },
  });
  if (!existing) return { error: "Address not found." };

  await db.$transaction(async (tx) => {
    if (wantDefault) {
      await tx.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }
    await tx.customerAddress.update({
      where: { id },
      data: { ...data, isDefault: wantDefault ? true : existing.isDefault },
    });
  });

  revalidatePath("/account/addresses");
  return { ok: true, message: "Address updated." };
}

export async function deleteAddress(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const customerId = await requireSessionId();
  if (!customerId) return { ok: false, error: "Your session has expired." };

  const existing = await db.customerAddress.findFirst({
    where: { id, customerId },
  });
  if (!existing) return { ok: false, error: "Address not found." };

  await db.$transaction(async (tx) => {
    await tx.customerAddress.delete({ where: { id } });
    if (existing.isDefault) {
      // Promote the earliest remaining address to default, if any.
      const next = await tx.customerAddress.findFirst({
        where: { customerId },
        orderBy: { createdAt: "asc" },
      });
      if (next) {
        await tx.customerAddress.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
  });

  revalidatePath("/account/addresses");
  return { ok: true };
}

export async function setDefaultAddress(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const customerId = await requireSessionId();
  if (!customerId) return { ok: false, error: "Your session has expired." };

  const existing = await db.customerAddress.findFirst({
    where: { id, customerId },
  });
  if (!existing) return { ok: false, error: "Address not found." };

  await db.$transaction(async (tx) => {
    await tx.customerAddress.updateMany({
      where: { customerId, isDefault: true },
      data: { isDefault: false },
    });
    await tx.customerAddress.update({
      where: { id },
      data: { isDefault: true },
    });
  });

  revalidatePath("/account/addresses");
  return { ok: true };
}
