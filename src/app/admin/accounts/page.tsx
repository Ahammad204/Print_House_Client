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
import {
  AddTransactionButton,
  DeleteTransactionButton,
  EditTransactionButton,
  type CategoryOption,
  type TransactionData,
} from "./TransactionForm";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;
const PAYMENT_METHODS = ["Cash", "bKash", "Nagad", "Bank", "Other"] as const;

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

type SearchParams = {
  q?: string;
  type?: string;
  categoryId?: string;
  paymentMethod?: string;
  from?: string;
  to?: string;
  page?: string;
};

function parseDateParam(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildPageHref(
  base: SearchParams,
  page: number
): string {
  const params = new URLSearchParams();
  if (base.q) params.set("q", base.q);
  if (base.type) params.set("type", base.type);
  if (base.categoryId) params.set("categoryId", base.categoryId);
  if (base.paymentMethod) params.set("paymentMethod", base.paymentMethod);
  if (base.from) params.set("from", base.from);
  if (base.to) params.set("to", base.to);
  params.set("page", String(page));
  return `/admin/accounts?${params.toString()}`;
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const type =
    sp.type === "income" || sp.type === "expense" ? sp.type : "";
  const categoryId = sp.categoryId ?? "";
  const paymentMethod = (sp.paymentMethod ?? "") as string;
  const fromDate = parseDateParam(sp.from);
  const toDate = parseDateParam(sp.to);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.AccountTransactionWhereInput = {};
  if (q) {
    where.OR = [
      { description: { contains: q, mode: "insensitive" } },
      { reference: { contains: q, mode: "insensitive" } },
    ];
  }
  if (type) where.type = type;
  if (categoryId) where.categoryId = categoryId;
  if (
    paymentMethod &&
    (PAYMENT_METHODS as readonly string[]).includes(paymentMethod)
  ) {
    where.paymentMethod = paymentMethod as (typeof PAYMENT_METHODS)[number];
  }
  if (fromDate || toDate) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (fromDate) dateFilter.gte = fromDate;
    if (toDate) {
      // Inclusive of the whole "to" day.
      dateFilter.lt = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);
    }
    where.date = dateFilter;
  }

  const [transactions, totalCount, categories, totals] = await Promise.all([
    prisma.accountTransaction.findMany({
      where,
      include: { category: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.accountTransaction.count({ where }),
    prisma.accountCategory.findMany({
      where: { status: "active" },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.accountTransaction.groupBy({
      by: ["type"],
      where,
      _sum: { amount: true },
    }),
  ]);

  const totalIncome = toNumber(
    totals.find((t) => t.type === "income")?._sum.amount ?? 0
  );
  const totalExpense = toNumber(
    totals.find((t) => t.type === "expense")?._sum.amount ?? 0
  );
  const net = totalIncome - totalExpense;

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const categoryOptions: CategoryOption[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type as "income" | "expense",
    status: c.status,
  }));

  const filterState: SearchParams = {
    q: q || undefined,
    type: type || undefined,
    categoryId: categoryId || undefined,
    paymentMethod: paymentMethod || undefined,
    from: sp.from,
    to: sp.to,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Daily Accounts</h1>
          <p className="text-sm text-slate-500">
            Record and review the shop&apos;s daily income and expenses.
          </p>
        </div>
        <AddTransactionButton categories={categoryOptions} />
      </div>

      {/* Summary strip — totals for the current filter */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-slate-500">
              Filtered Income
            </p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {formatBDT(totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-slate-500">
              Filtered Expense
            </p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {formatBDT(totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-slate-500">Net</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                net >= 0 ? "text-blue-600" : "text-red-600"
              }`}
            >
              {formatBDT(net)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form
            method="get"
            action="/admin/accounts"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Input
              type="search"
              name="q"
              placeholder="Search description or reference..."
              defaultValue={q}
            />
            <select name="type" defaultValue={type} className={selectClass}>
              <option value="">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <select
              name="categoryId"
              defaultValue={categoryId}
              className={selectClass}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
            <select
              name="paymentMethod"
              defaultValue={paymentMethod}
              className={selectClass}
            >
              <option value="">All payment methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <label htmlFor="from" className="text-sm text-slate-500">
                From
              </label>
              <Input
                id="from"
                type="date"
                name="from"
                defaultValue={sp.from ?? ""}
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="to" className="text-sm text-slate-500">
                To
              </label>
              <Input
                id="to"
                type="date"
                name="to"
                defaultValue={sp.to ?? ""}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Filter</Button>
              <Button variant="outline" asChild>
                <Link href="/admin/accounts">Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No transactions found for the selected filters.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Income</TableHead>
                    <TableHead className="text-right">Expense</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const txData: TransactionData = {
                      id: tx.id,
                      type: tx.type as "income" | "expense",
                      categoryId: tx.categoryId,
                      amount: toNumber(tx.amount),
                      description: tx.description,
                      date: tx.date.toISOString().slice(0, 10),
                      paymentMethod: tx.paymentMethod as TransactionData["paymentMethod"],
                      reference: tx.reference,
                    };
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(tx.date)}
                        </TableCell>
                        <TableCell>{tx.category.name}</TableCell>
                        <TableCell>
                          <div>{tx.description}</div>
                          {tx.reference && (
                            <div className="text-xs text-slate-500">
                              {tx.reference}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {tx.type === "income" ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                              Income
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                              Expense
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-700">
                          {tx.type === "income"
                            ? formatBDT(tx.amount)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-700">
                          {tx.type === "expense"
                            ? formatBDT(tx.amount)
                            : "—"}
                        </TableCell>
                        <TableCell>{tx.paymentMethod}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <EditTransactionButton
                              categories={categoryOptions}
                              transaction={txData}
                            />
                            <DeleteTransactionButton
                              id={tx.id}
                              description={tx.description}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page {currentPage} of {totalPages} ({totalCount}{" "}
                    transaction{totalCount === 1 ? "" : "s"})
                  </p>
                  <div className="flex gap-2">
                    {currentPage > 1 && (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={buildPageHref(filterState, currentPage - 1)}
                        >
                          Previous
                        </Link>
                      </Button>
                    )}
                    {currentPage < totalPages && (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={buildPageHref(filterState, currentPage + 1)}
                        >
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
