import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/cart/products?ids=a,b,c — public product snapshots for rendering
 * the guest (localStorage) cart. Only products with status != "hidden".
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
  if (ids.length === 0) return NextResponse.json([]);
  try {
    const products = await db.product.findMany({
      where: { id: { in: ids }, status: { not: "hidden" } },
      include: { images: { orderBy: { order: "asc" }, take: 1 } },
    });
    return NextResponse.json(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        discountPrice: p.discountPrice === null ? null : Number(p.discountPrice),
        image: p.images[0]?.url ?? null,
        stock: p.stock,
        status: p.status,
      })),
    );
  } catch {
    // Database unreachable — guest cart renders empty rather than erroring.
    return NextResponse.json([]);
  }
}
