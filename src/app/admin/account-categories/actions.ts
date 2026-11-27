"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db as prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(["income", "expense"]),
  description: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]),
});

type ActionResult = { success: true } | { success: false; error: string };

function revalidateCategories() {
  revalidatePath("/admin/account-categories");
  revalidatePath("/admin/accounts");
}

export async function createAccountCategory(
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  const duplicate = await prisma.accountCategory.findFirst({
    where: {
      name: { equals: data.name, mode: "insensitive" },
      type: data.type,
    },
  });
  if (duplicate) {
    return {
      success: false,
      error: `A ${data.type} category named "${data.name}" already exists`,
    };
  }

  try {
    await prisma.accountCategory.create({
      data: {
        name: data.name,
        type: data.type,
        description: data.description || null,
        status: data.status,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return {
        success: false,
        error: `A ${data.type} category named "${data.name}" already exists`,
      };
    }
    throw error;
  }

  revalidateCategories();
  return { success: true };
}

export async function updateAccountCategory(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  const existing = await prisma.accountCategory.findUnique({
    where: { id },
  });
  if (!existing) return { success: false, error: "Category not found" };

  const duplicate = await prisma.accountCategory.findFirst({
    where: {
      name: { equals: data.name, mode: "insensitive" },
      type: data.type,
      id: { not: id },
    },
  });
  if (duplicate) {
    return {
      success: false,
      error: `A ${data.type} category named "${data.name}" already exists`,
    };
  }

  try {
    await prisma.accountCategory.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        description: data.description || null,
        status: data.status,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return {
        success: false,
        error: `A ${data.type} category named "${data.name}" already exists`,
      };
    }
    throw error;
  }

  revalidateCategories();
  return { success: true };
}

export async function deleteAccountCategory(
  id: string
): Promise<ActionResult> {
  await requireAdmin();
  const existing = await prisma.accountCategory.findUnique({
    where: { id },
  });
  if (!existing) return { success: false, error: "Category not found" };

  const usageCount = await prisma.accountTransaction.count({
    where: { categoryId: id },
  });
  if (usageCount > 0) {
    return {
      success: false,
      error: `Cannot delete: ${usageCount} transaction(s) use this category.`,
    };
  }

  await prisma.accountCategory.delete({ where: { id } });

  revalidateCategories();
  return { success: true };
}
