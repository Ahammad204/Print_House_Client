import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db as prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatBDT, formatDate, toNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

type SearchParams = {
  q?: string;
  status?: string;
  page?: string;
};

function buildPageHref(base: SearchParams, page: number): string {
  const params = new URLSearchParams();
  if (base.q) params.set("q", base.q);
  if (base.status) params.set("status", base.status);
  params.set("page", String(page));
  return `/admin/customers?${params.toString()}`;
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = sp.status === "active" || sp.status === "disabled" ? sp.status : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.CustomerWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status;

  const [customers, totalCount] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.customer.count({ where }),
  ]);

  const ids = customers.map((c) => c.id);

  // Per-customer order stats, computed with Prisma aggregates (never by
  // loading all orders into memory).
  const [paidStats, allStats] = await Promise.all([
    ids.length === 0
      ? []
      : prisma.order.groupBy({
          by: ["customerId"],
          where: {
            customerId: { in: ids },
            paymentStatus: { in: ["paid", "partially_paid"] },
          },
          _sum: { total: true },
        }),
    ids.length === 0
      ? []
      : prisma.order.groupBy({
          by: ["customerId"],
          where: { customerId: { in: ids } },
          _count: { _all: true },
          _max: { createdAt: true },
        }),
  ]);

  const paidByCustomer = new Map(
    paidStats.map((s) => [s.customerId, toNumber(s._sum.total ?? 0)])
  );
  const allByCustomer = new Map(
    allStats.map(
      (s) =>
        [
          s.customerId,
          { count: s._count._all, lastOrderAt: s._max.createdAt },
        ] as const
    )
  );
  const statsFor = (customerId: string) => {
    const all = allByCustomer.get(customerId);
    return {
      totalOrders: all?.count ?? 0,
      totalPurchased: paidByCustomer.get(customerId) ?? 0,
      lastOrderAt: all?.lastOrderAt ?? null,
    };
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const filterState: SearchParams = {
    q: q || undefined,
    status: status || undefined,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Customers</h1>
        <p className="text-sm text-slate-500">
          Registered customers, their orders and purchase totals.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form
            method="get"
            action="/admin/customers"
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <Input
              type="search"
              name="q"
              placeholder="Search name, phone or email..."
              defaultValue={q}
            />
            <select name="status" defaultValue={status} className={selectClass}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit">Filter</Button>
              <Button variant="outline" asChild>
                <Link href="/admin/customers">Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {customers.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No customers found for the selected filters.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Total Purchased</TableHead>
                      <TableHead>Last Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => {
                      const stats = statsFor(customer.id);
                      return (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">
                            {customer.name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {customer.phone}
                          </TableCell>
                          <TableCell>{customer.email ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(customer.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            {stats.totalOrders}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatBDT(stats.totalPurchased)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {stats.lastOrderAt
                              ? formatDate(stats.lastOrderAt)
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                customer.status === "active"
                                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                                  : "bg-red-100 text-red-800 hover:bg-red-100"
                              }
                            >
                              {customer.status === "active"
                                ? "Active"
                                : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/admin/customers/${customer.id}`}>
                                View
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page {currentPage} of {totalPages} ({totalCount} customer
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
    </div>
  );
}
