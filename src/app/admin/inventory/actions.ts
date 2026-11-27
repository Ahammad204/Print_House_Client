"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

type ActionResult = { ok: true } | { ok: false; error: string };

const adjustSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  delta: z.coerce
    .number()
    .int("Adjustment must be a whole number")
    .refine((v) => v !== 0, "Adjustment cannot be zero"),
  reason: z.string().trim().min(1, "A reason is required"),
});

/**
 * Adjust stock by a signed delta. Positive = restock, negative = manual
 * reduction. The movement is recorded with previous → new stock. Stock
 * can never go below 0.
 */
export async function adjustStock(
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = adjustSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { productId, delta, reason } = parsed.data;
  try {
    await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw new Error("Product not found.");
      const newStock = product.stock + delta;
      if (newStock < 0) {
        throw new Error(
          `Cannot reduce stock below 0 (current stock: ${product.stock}).`
        );
      }
      await tx.product.update({
        where: { id: product.id },
        data: { stock: newStock },
      });
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: "adjustment",
          quantity: delta,
          previousStock: product.stock,
          newStock,
          reason,
        },
      });
    });
    revalidatePath("/admin/inventory");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not adjust stock.",
    };
  }
}
