import Link from "next/link";
import { db as prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
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
  AddCategoryButton,
  DeleteCategoryButton,
  EditCategoryButton,
  type AccountCategoryData,
} from "./CategoryForm";

export const dynamic = "force-dynamic";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

type SearchParams = {
  q?: string;
  type?: string;
};

export default async function AccountCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const type =
    sp.type === "income" || sp.type === "expense" ? sp.type : "";

  const categories = await prisma.accountCategory.findMany({
    where: {
      ...(q
        ? { name: { contains: q, mode: "insensitive" } }
        : {}),
      ...(type ? { type } : {}),
    },
    include: { _count: { select: { transactions: true } } },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Account Categories</h1>
          <p className="text-sm text-slate-500">
            Income and expense categories used in daily accounts.
          </p>
        </div>
        <AddCategoryButton />
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            method="get"
            action="/admin/account-categories"
            className="flex flex-wrap gap-3"
          >
            <Input
              type="search"
              name="q"
              placeholder="Search categories..."
              defaultValue={q}
              className="max-w-sm"
            />
            <select
              name="type"
              defaultValue={type}
              className={`${selectClass} max-w-44`}
            >
              <option value="">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <Button type="submit">Filter</Button>
            <Button variant="outline" asChild>
              <Link href="/admin/account-categories">Reset</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No categories found. Add your first income or expense category.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => {
                  const data: AccountCategoryData = {
                    id: c.id,
                    name: c.name,
                    type: c.type as "income" | "expense",
                    description: c.description,
                    status: c.status as "active" | "inactive",
                  };
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        {c.type === "income" ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            Income
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                            Expense
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-64 truncate text-slate-500">
                        {c.description ?? "—"}
                      </TableCell>
                      <TableCell>
                        {c.status === "active" ? (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {c._count.transactions}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(c.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <EditCategoryButton category={data} />
                          <DeleteCategoryButton id={c.id} name={c.name} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
