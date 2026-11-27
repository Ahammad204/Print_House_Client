import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db as prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdjustStockButton } from "./InventoryActions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchParams = {
  q?: string;
  low?: string;
  page?: string;
};

type StockRow = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  lowStockThreshold: number;
  status: string;
  categoryName: string;
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  sale: "Sale",
  restock: "Restock",
  adjustment: "Adjustment",
  return: "Return",
  cancellation: "Cancellation",
};

function buildPageHref(base: SearchParams, page: number): string {
  const params = new URLSearchParams();
  if (base.q) params.set("q", base.q);
  if (base.low) params.set("low", base.low);
  params.set("page", String(page));
  return `/admin/inventory?${params.toString()}`;
}

function stockBadge(stock: number, threshold: number) {
  if (stock <= 0) {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
        Out of Stock
      </Badge>
    );
  }
  if (stock <= threshold) {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        Low Stock
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
      In Stock
    </Badge>
  );
}

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const lowOnly = sp.low === "1";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  let rows: StockRow[];
  let totalCount: number;

  if (lowOnly) {
    // Prisma cannot compare two columns in a where clause, so the
    // stock <= lowStockThreshold filter runs as a parameterised raw query.
    const searchSql = q
      ? Prisma.sql`AND (p."name" ILIKE ${`%${q}%`} OR p."sku" ILIKE ${`%${q}%`})`
      : Prisma.empty;
    const offset = (page - 1) * PAGE_SIZE;
    const [lowRows, countRows] = await Promise.all([
      prisma.$queryRaw<StockRow[]>(Prisma.sql`
        SELECT p."id", p."name", p."sku", p."stock", p."lowStockThreshold", p."status",
               c."name" AS "categoryName"
        FROM "Product" p
        JOIN "ProductCategory" c ON c."id" = p."categoryId"
        WHERE p."stock" <= p."lowStockThreshold" ${searchSql}
        ORDER BY p."name" ASC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `),
      prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS "count"
        FROM "Product" p
        WHERE p."stock" <= p."lowStockThreshold" ${searchSql}
      `),
    ]);
    rows = lowRows;
    totalCount = countRows[0]?.count ?? 0;
  } else {
    const where: Prisma.ProductWhereInput = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ];
    }
    const [products, count] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [{ name: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { category: { select: { name: true } } },
      }),
      prisma.product.count({ where }),
    ]);
    rows = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      stock: p.stock,
      lowStockThreshold: p.lowStockThreshold,
      status: p.status,
      categoryName: p.category.name,
    }));
    totalCount = count;
  }

  const lowCount = await prisma.$queryRaw<{ count: number }[]>(
    Prisma.sql`SELECT COUNT(*)::int AS "count" FROM "Product" WHERE "stock" <= "lowStockThreshold"`
  );
  const lowStockTotal = lowCount[0]?.count ?? 0;

  const movements = await prisma.stockMovement.findMany({
    take: 30,
    orderBy: [{ createdAt: "desc" }],
    include: {
      product: { select: { name: true } },
      order: { select: { orderNumber: true } },
    },
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const filterState: SearchParams = {
    q: q || undefined,
    low: lowOnly ? "1" : undefined,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Inventory</h1>
          <p className="text-sm text-slate-500">
            Stock levels and recent stock movements. Stock is deducted
            automatically when an order is confirmed and restored on
            cancellation.
          </p>
        </div>
        <Card className="px-4 py-3">
          <p className="text-sm text-slate-500">
            <span className="text-lg font-bold text-amber-600">
              {lowStockTotal}
            </span>{" "}
            product{lowStockTotal === 1 ? "" : "s"} at or below low-stock
            threshold
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form
            method="get"
            action="/admin/inventory"
            className="flex flex-wrap items-center gap-3"
          >
            <Input
              type="search"
              name="q"
              placeholder="Search product name or SKU..."
              defaultValue={q}
              className="max-w-xs"
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="low"
                value="1"
                defaultChecked={lowOnly}
                className="h-4 w-4 accent-primary"
              />
              Low stock only
            </label>
            <Button type="submit">Filter</Button>
            <Button variant="outline" asChild>
              <Link href="/admin/inventory">Reset</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Stock table */}
      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {lowOnly
                ? "No low-stock products found."
                : "No products found for the selected filters."}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Low-Stock At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {product.sku ?? "—"}
                        </TableCell>
                        <TableCell>{product.categoryName}</TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-bold",
                            product.stock <= 0
                              ? "text-red-600"
                              : product.stock <= product.lowStockThreshold
                                ? "text-amber-600"
                                : "text-navy"
                          )}
                        >
                          {product.stock}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.lowStockThreshold}
                        </TableCell>
                        <TableCell>{stockBadge(product.stock, product.lowStockThreshold)}</TableCell>
                        <TableCell className="text-right">
                          <AdjustStockButton
                            productId={product.id}
                            productName={product.name}
                            currentStock={product.stock}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page {currentPage} of {totalPages} ({totalCount} product
                    {totalCount === 1 ? "" : "s"})
                  </p>
                  <div className="flex gap-2">
                    {currentPage > 1 && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={buildPageHref(filterState, currentPage - 1)}>
                          Previous
                        </Link>
                      </Button>
                    )}
                    {currentPage < totalPages && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={buildPageHref(filterState, currentPage + 1)}>
                          Next
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent stock movements */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Stock Movements</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No stock movements yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(m.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {m.product.name}
                      </TableCell>
                      <TableCell>
                        {MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium",
                          m.quantity < 0 ? "text-red-600" : "text-green-600"
                        )}
                      >
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {m.previousStock} → {m.newStock}
                      </TableCell>
                      <TableCell>
                        {m.order ? (
                          <Link
                            href={`/admin/orders/${m.orderId}`}
                            className="text-primary hover:underline"
                          >
                            {m.order.orderNumber}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate">
                        {m.reason ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
