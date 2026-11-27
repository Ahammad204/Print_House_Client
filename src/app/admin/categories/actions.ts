"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db as prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export type ActionResult = {
  success: boolean;
  error?: string;
  errors?: Record<string, string[]>;
};

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  slug: z.string().trim().min(1, "Slug is required"),
  description: z.string().trim().optional().default(""),
  image: z.string().trim().optional().default(""),
  status: z.enum(["active", "inactive"], {
    errorMap: () => ({ message: "Choose a valid status" }),
  }),
  order: z
    .string()
    .refine((v) => v.trim() !== "" && Number.isInteger(Number(v)) && Number(v) >= 0, {
      message: "Order must be a whole number of 0 or more",
    }),
});

function flattenErrors(
  fieldErrors: Record<string, string[] | undefined>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(fieldErrors)) {
    if (value) out[key] = value;
  }
  return out;
}

function formToObject(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    image: String(formData.get("image") ?? ""),
    status: String(formData.get("status") ?? ""),
    order: String(formData.get("order") ?? ""),
  };
}

function revalidateCategories() {
  revalidatePath("/admin/categories");
  revalidatePath("/");
  revalidatePath("/products");
}

export async function createCategory(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { success: false, errors: flattenErrors(parsed.error.flatten().fieldErrors) };
  }
  const data = parsed.data;

  const duplicate = await prisma.productCategory.findFirst({
    where: { OR: [{ name: data.name }, { slug: data.slug }] },
  });
  if (duplicate) {
    return {
      success: false,
      error: "A category with this name or slug already exists.",
    };
  }

  await prisma.productCategory.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      image: data.image,
      status: data.status,
      order: Number(data.order),
    },
  });

  revalidateCategories();
  return { success: true };
}

export async function updateCategory(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { success: false, errors: flattenErrors(parsed.error.flatten().fieldErrors) };
  }
  const data = parsed.data;

  const existing = await prisma.productCategory.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Category not found." };
  }

  const duplicate = await prisma.productCategory.findFirst({
    where: {
      OR: [{ name: data.name }, { slug: data.slug }],
      id: { not: id },
    },
  });
  if (duplicate) {
    return {
      success: false,
      error: "A category with this name or slug already exists.",
    };
  }

  await prisma.productCategory.update({
    where: { id },
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      image: data.image,
      status: data.status,
      order: Number(data.order),
    },
  });

  revalidateCategories();
  return { success: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();
  const existing = await prisma.productCategory.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Category not found." };
  }

  const productCount = await prisma.product.count({
    where: { categoryId: id },
  });
  if (productCount > 0) {
    return {
      success: false,
      error: `Cannot delete: ${productCount} product(s) use this category. Reassign them first.`,
    };
  }

  await prisma.productCategory.delete({ where: { id } });
  revalidateCategories();
  return { success: true };
}
