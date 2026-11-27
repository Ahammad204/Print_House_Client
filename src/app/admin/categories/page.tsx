import { Prisma } from "@prisma/client";
import { Search } from "lucide-react";
import { db as prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryTable, type CategoryRow } from "./CategoryForm";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const where: Prisma.ProductCategoryWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const categories = await prisma.productCategory.findMany({
    where,
    include: { _count: { select: { products: true } } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  const rows: CategoryRow[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description ?? "",
    image: c.image ?? null,
    status: c.status,
    order: c.order,
    productCount: c._count.products,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#14213D]">Categories</h1>
        <p className="text-sm text-slate-500">
          {rows.length} categor{rows.length === 1 ? "y" : "ies"}
        </p>
      </div>

      <form method="get" className="flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search categories…"
            className="bg-white pl-9"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      <CategoryTable categories={rows} />
    </div>
  );
}
