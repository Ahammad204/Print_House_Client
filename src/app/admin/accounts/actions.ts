"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db as prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const PAYMENT_METHODS = ["Cash", "bKash", "Nagad", "Bank", "Other"] as const;

const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  categoryId: z.string().min(1, "Category is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().trim().min(1, "Description is required"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .refine(
      (v) => !Number.isNaN(new Date(`${v}T00:00:00.000Z`).getTime()),
      "Invalid date"
    ),
  paymentMethod: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().optional(),
});

type ActionResult = { success: true } | { success: false; error: string };

function revalidateAccounts() {
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/reports");
}

async function validateCategory(
  categoryId: string,
  type: "income" | "expense"
): Promise<string | null> {
  const category = await prisma.accountCategory.findUnique({
    where: { id: categoryId },
  });
  if (!category) return "Category not found";
  if (category.type !== type || category.status !== "active") {
    return "Category does not match the transaction type";
  }
  return null;
}

export async function createTransaction(
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = transactionSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  const categoryError = await validateCategory(data.categoryId, data.type);
  if (categoryError) return { success: false, error: categoryError };

  await prisma.accountTransaction.create({
    data: {
      type: data.type,
      categoryId: data.categoryId,
      amount: new Prisma.Decimal(data.amount),
      description: data.description,
      date: new Date(`${data.date}T00:00:00.000Z`),
      paymentMethod: data.paymentMethod,
      reference: data.reference || null,
    },
  });

  revalidateAccounts();
  return { success: true };
}

export async function updateTransaction(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = transactionSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  const existing = await prisma.accountTransaction.findUnique({
    where: { id },
  });
  if (!existing) return { success: false, error: "Transaction not found" };

  const categoryError = await validateCategory(data.categoryId, data.type);
  if (categoryError) return { success: false, error: categoryError };

  await prisma.accountTransaction.update({
    where: { id },
    data: {
      type: data.type,
      categoryId: data.categoryId,
      amount: new Prisma.Decimal(data.amount),
      description: data.description,
      date: new Date(`${data.date}T00:00:00.000Z`),
      paymentMethod: data.paymentMethod,
      reference: data.reference || null,
    },
  });

  revalidateAccounts();
  return { success: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const existing = await prisma.accountTransaction.findUnique({
    where: { id },
  });
  if (!existing) return { success: false, error: "Transaction not found" };

  await prisma.accountTransaction.delete({ where: { id } });

  revalidateAccounts();
  return { success: true };
}
