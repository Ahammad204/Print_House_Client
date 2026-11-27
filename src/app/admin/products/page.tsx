import { Prisma } from "@prisma/client";
import { db as prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { toNumber } from "@/lib/utils";
import { ProductTable, type ProductRow } from "./ProductTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type SearchParams = {
  q?: string;
  category?: string;
  status?: string;
  page?: string;
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const category = params.category ?? "";
  const status = params.status ?? "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const where: Prisma.ProductWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
    ];
  }
  if (category) where.categoryId = category;
  if (status) {
    where.status = status as "available" | "out_of_stock" | "hidden";
  }

  const [products, total, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        images: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where }),
    prisma.productCategory.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: toNumber(p.price),
    discountPrice: p.discountPrice != null ? toNumber(p.discountPrice) : null,
    sku: p.sku,
    stock: p.stock,
    status: p.status,
    featured: p.featured,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? "—",
    images: p.images.map((img) => ({ url: img.url })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#14213D]">Products</h1>
        <p className="text-sm text-slate-500">
          {total} product{total === 1 ? "" : "s"} in the shop
        </p>
      </div>

      <ProductTable
        products={rows}
        categories={categories}
        total={total}
        totalPages={totalPages}
        page={page}
        filters={{ q, category, status }}
      />
    </div>
  );
}
