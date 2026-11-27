"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatBDT } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ReportView = "daily" | "monthly" | "range";

export type CategoryBreakdown = {
  name: string;
  amount: number;
  share: number;
};

export type DailyPoint = {
  date: string;
  label: string;
  income: number;
  expense: number;
};

export type ReportTransaction = {
  id: string;
  date: string;
  category: string;
  description: string;
  type: "income" | "expense";
  paymentMethod: string;
  amount: number;
  reference: string | null;
};

export type ReportTotals = {
  income: number;
  expense: number;
  net: number;
  count: number;
};

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadFile(filename: string, content: string | Blob, mime: string) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ReportView({
  shopName,
  view,
  date,
  year,
  month,
  from,
  to,
  periodLabel,
  totals,
  incomeByCategory,
  expenseByCategory,
  daily,
  transactions,
}: {
  shopName: string;
  view: ReportView;
  date: string;
  year: number;
  month: number;
  from: string;
  to: string;
  periodLabel: string;
  totals: ReportTotals;
  incomeByCategory: CategoryBreakdown[];
  expenseByCategory: CategoryBreakdown[];
  daily: DailyPoint[];
  transactions: ReportTransaction[];
}) {
  const router = useRouter();

  const fileBase = useMemo(() => {
    const slug = periodLabel.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();
    return `financial-report-${view}-${slug}`;
  }, [periodLabel, view]);

  function navigate(params: Record<string, string>) {
    const search = new URLSearchParams(params);
    router.push(`/admin/reports?${search.toString()}`);
  }

  function setView(next: ReportView) {
    navigate({ view: next, date, year: String(year), month: String(month), from, to });
  }

  function exportCSV() {
    const lines: string[] = [
      shopName,
      `Financial Report — ${view} (${periodLabel})`,
      `Total Income,${formatBDT(totals.income)}`,
      `Total Expense,${formatBDT(totals.expense)}`,
      `Net,${formatBDT(totals.net)}`,
      `Transactions,${totals.count}`,
      "",
      "Date,Category,Description,Type,Payment Method,Amount,Reference",
      ...transactions.map((tx) =>
        [
          tx.date,
          tx.category,
          tx.description,
          tx.type,
          tx.paymentMethod,
          tx.amount.toFixed(2),
          tx.reference ?? "",
        ]
          .map(csvEscape)
          .join(",")
      ),
    ];
    downloadFile(`${fileBase}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  }

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(shopName, 14, 16);
    doc.setFontSize(12);
    doc.text("Financial Report", 14, 24);
    doc.setFontSize(10);
    doc.text(`Period: ${view} — ${periodLabel}`, 14, 31);
    doc.text(`Total Income: ${formatBDT(totals.income)}`, 14, 38);
    doc.text(`Total Expense: ${formatBDT(totals.expense)}`, 14, 44);
    doc.text(`Net: ${formatBDT(totals.net)}`, 14, 50);
    doc.text(`Transactions: ${totals.count}`, 14, 56);

    autoTable(doc, {
      startY: 62,
      head: [["Date", "Category", "Description", "Type", "Amount"]],
      body: transactions.map((tx) => [
        tx.date,
        tx.category,
        tx.description,
        tx.type === "income" ? "Income" : "Expense",
        formatBDT(tx.amount),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save(`${fileBase}.pdf`);
  }

  function BreakdownTable({
    title,
    rows,
    total,
    accent,
  }: {
    title: string;
    rows: CategoryBreakdown[];
    total: number;
    accent: "green" | "red";
  }) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No {title.toLowerCase()} in this period.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        accent === "green" ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {formatBDT(r.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.share.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">
                    {formatBDT(total)}
                  </TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  }

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const years = Array.from({ length: 6 }, (_, i) => year - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Financial Reports</h1>
          <p className="text-sm text-slate-500">
            {shopName} — {periodLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={exportPDF}>
            <FileText className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2">
              {(["daily", "monthly", "range"] as const).map((v) => (
                <Button
                  key={v}
                  variant={view === v ? "default" : "outline"}
                  onClick={() => setView(v)}
                  className="capitalize"
                >
                  {v}
                </Button>
              ))}
            </div>

            {view === "daily" && (
              <Input
                type="date"
                value={date}
                onChange={(e) => {
                  if (e.target.value)
                    navigate({ view, date: e.target.value });
                }}
                className="max-w-44"
              />
            )}

            {view === "monthly" && (
              <>
                <Select
                  value={String(month)}
                  onValueChange={(v) =>
                    navigate({ view, year: String(year), month: v })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(year)}
                  onValueChange={(v) =>
                    navigate({ view, year: v, month: String(month) })
                  }
                >
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {view === "range" && (
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  navigate({
                    view,
                    from: String(data.get("from") ?? from),
                    to: String(data.get("to") ?? to),
                  });
                }}
              >
                <Input
                  type="date"
                  name="from"
                  defaultValue={from}
                  className="max-w-44"
                />
                <span className="text-sm text-slate-500">to</span>
                <Input
                  type="date"
                  name="to"
                  defaultValue={to}
                  className="max-w-44"
                />
                <Button type="submit" size="sm">
                  Apply
                </Button>
              </form>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-slate-500">Total Income</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {formatBDT(totals.income)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-slate-500">Total Expense</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {formatBDT(totals.expense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-slate-500">Net</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                totals.net >= 0 ? "text-blue-600" : "text-red-600"
              }`}
            >
              {formatBDT(totals.net)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-slate-500">Transactions</p>
            <p className="mt-1 text-2xl font-bold text-navy">
              {totals.count}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Daily Income vs Expense — {periodLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {daily.length === 0 || totals.count === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No transactions in this period.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => formatBDT(Number(value ?? 0))}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#16a34a" />
                  <Bar dataKey="expense" name="Expense" fill="#dc2626" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownTable
          title="Income by Category"
          rows={incomeByCategory}
          total={totals.income}
          accent="green"
        />
        <BreakdownTable
          title="Expense by Category"
          rows={expenseByCategory}
          total={totals.expense}
          accent="red"
        />
      </div>

      {/* Transaction table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Transactions — {periodLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No transactions in this period.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap">
                      {tx.date}
                    </TableCell>
                    <TableCell>{tx.category}</TableCell>
                    <TableCell>
                      <div>{tx.description}</div>
                      {tx.reference && (
                        <div className="text-xs text-slate-500">
                          {tx.reference}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {tx.type === "income" ? "Income" : "Expense"}
                    </TableCell>
                    <TableCell>{tx.paymentMethod}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        tx.type === "income"
                          ? "text-green-700"
                          : "text-red-700"
                      }`}
                    >
                      {formatBDT(tx.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-1 text-xs text-slate-400">
        <Download className="h-3 w-3" />
        Exports include the shop name, report period, totals and the full
        transaction list above.
      </p>
    </div>
  );
}
