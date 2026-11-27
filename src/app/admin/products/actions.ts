"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db as prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export type ActionResult = {
  success: boolean;
  error?: string;
  errors?: Record<string, string[]>;
};

const productSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    slug: z.string().trim().min(1, "Slug is required"),
    description: z.string().trim().optional().default(""),
    price: z
      .string()
      .refine((v) => v.trim() !== "" && !Number.isNaN(Number(v)) && Number(v) > 0, {
        message: "Price must be greater than 0",
      }),
    discountPrice: z.string().trim().optional().default(""),
    sku: z.string().trim().optional().default(""),
    stock: z
      .string()
      .refine((v) => v.trim() !== "" && Number.isInteger(Number(v)) && Number(v) >= 0, {
        message: "Stock must be a whole number of 0 or more",
      }),
    status: z.enum(["available", "out_of_stock", "hidden"], {
      errorMap: () => ({ message: "Choose a valid status" }),
    }),
    categoryId: z.string().min(1, "Category is required"),
    featured: z.string().optional().default(""),
    images: z.string().optional().default("[]"),
  })
  .superRefine((data, ctx) => {
    if (data.discountPrice.trim() !== "") {
      const discount = Number(data.discountPrice);
      if (Number.isNaN(discount) || discount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["discountPrice"],
          message: "Discount price must be greater than 0",
        });
      } else if (discount >= Number(data.price)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["discountPrice"],
          message: "Discount price must be less than the price",
        });
      }
    }
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
    price: String(formData.get("price") ?? ""),
    discountPrice: String(formData.get("discountPrice") ?? ""),
    sku: String(formData.get("sku") ?? ""),
    stock: String(formData.get("stock") ?? ""),
    status: String(formData.get("status") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    featured: String(formData.get("featured") ?? ""),
    images: String(formData.get("images") ?? "[]"),
  };
}

function parseImages(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((u): u is string => typeof u === "string" && u.trim() !== "");
  } catch {
    return [];
  }
}

function revalidateProducts() {
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = productSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { success: false, errors: flattenErrors(parsed.error.flatten().fieldErrors) };
  }
  const data = parsed.data;

  const category = await prisma.productCategory.findUnique({
    where: { id: data.categoryId },
  });
  if (!category) {
    return { success: false, error: "Selected category does not exist." };
  }

  const slugTaken = await prisma.product.findUnique({ where: { slug: data.slug } });
  if (slugTaken) {
    return { success: false, error: "Slug already in use. Choose a different slug." };
  }

  if (data.sku.trim() !== "") {
    const skuTaken = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (skuTaken) {
      return { success: false, error: "SKU already in use. Choose a different SKU." };
    }
  }

  const imageUrls = parseImages(data.images);
  await prisma.product.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      price: new Prisma.Decimal(data.price),
      discountPrice:
        data.discountPrice.trim() !== ""
          ? new Prisma.Decimal(data.discountPrice)
          : null,
      sku: data.sku.trim() !== "" ? data.sku : null,
      stock: Number(data.stock),
      status: data.status,
      featured: data.featured === "true" || data.featured === "on",
      categoryId: data.categoryId,
      images: {
        create: imageUrls.map((url, index) => ({ url, order: index })),
      },
    },
  });

  revalidateProducts();
  return { success: true };
}

export async function updateProduct(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = productSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { success: false, errors: flattenErrors(parsed.error.flatten().fieldErrors) };
  }
  const data = parsed.data;

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Product not found." };
  }

  const category = await prisma.productCategory.findUnique({
    where: { id: data.categoryId },
  });
  if (!category) {
    return { success: false, error: "Selected category does not exist." };
  }

  const slugTaken = await prisma.product.findFirst({
    where: { slug: data.slug, id: { not: id } },
  });
  if (slugTaken) {
    return { success: false, error: "Slug already in use. Choose a different slug." };
  }

  if (data.sku.trim() !== "") {
    const skuTaken = await prisma.product.findFirst({
      where: { sku: data.sku, id: { not: id } },
    });
    if (skuTaken) {
      return { success: false, error: "SKU already in use. Choose a different SKU." };
    }
  }

  const imageUrls = parseImages(data.images);
  await prisma.$transaction([
    prisma.productImage.deleteMany({ where: { productId: id } }),
    prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        price: new Prisma.Decimal(data.price),
        discountPrice:
          data.discountPrice.trim() !== ""
            ? new Prisma.Decimal(data.discountPrice)
            : null,
        sku: data.sku.trim() !== "" ? data.sku : null,
        stock: Number(data.stock),
        status: data.status,
        featured: data.featured === "true" || data.featured === "on",
        categoryId: data.categoryId,
        images: {
          create: imageUrls.map((url, index) => ({ url, order: index })),
        },
      },
    }),
  ]);

  revalidateProducts();
  return { success: true };
}

/**
 * M12: a product referenced by any non-cancelled order cannot be deleted
 * — deleting it would null its OrderItems (onDelete: SetNull) and the
 * order would then confirm/ship with no stock movement at all.
 */
async function findBlockingOrderItem(
  productIds: string[],
): Promise<{ productName: string; orderNumber: string } | null> {
  const item = await prisma.orderItem.findFirst({
    where: {
      productId: { in: productIds },
      order: { status: { not: "cancelled" } },
    },
    include: {
      product: { select: { name: true } },
      order: { select: { orderNumber: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!item) return null;
  return {
    productName: item.product?.name ?? "This product",
    orderNumber: item.order.orderNumber,
  };
}

function blockingDeleteError(blocking: {
  productName: string;
  orderNumber: string;
}): ActionResult {
  return {
    success: false,
    error: `Cannot delete "${blocking.productName}" — it is referenced by active order ${blocking.orderNumber}. Set the product to unavailable instead of deleting it.`,
  };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireAdmin();
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Product not found." };
  }
  const blocking = await findBlockingOrderItem([id]);
  if (blocking) return blockingDeleteError(blocking);
  await prisma.$transaction([
    prisma.productImage.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ]);
  revalidateProducts();
  return { success: true };
}

export async function bulkDeleteProducts(ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  if (ids.length === 0) {
    return { success: false, error: "No products selected." };
  }
  const blocking = await findBlockingOrderItem(ids);
  if (blocking) return blockingDeleteError(blocking);
  await prisma.$transaction([
    prisma.productImage.deleteMany({ where: { productId: { in: ids } } }),
    prisma.product.deleteMany({ where: { id: { in: ids } } }),
  ]);
  revalidateProducts();
  return { success: true };
}

export async function toggleFeatured(
  id: string,
  featured: boolean
): Promise<ActionResult> {
  await requireAdmin();
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Product not found." };
  }
  await prisma.product.update({ where: { id }, data: { featured } });
  revalidateProducts();
  return { success: true };
}
