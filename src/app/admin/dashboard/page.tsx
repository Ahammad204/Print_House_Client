import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { db as prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  dhakaMonthRange,
  dhakaTodayRange,
  formatBDT,
  formatDate,
  toNumber,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  CategoryBreakdownChart,
  DailyIncomeExpenseChart,
  MonthlyIncomeExpenseChart,
  type CategorySlice,
  type SeriesPoint,
} from "@/components/admin/charts";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function dhakaParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function dhakaDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dhakaDayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
  }).format(date);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function ComparisonLine({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <p className="text-xs text-slate-400">— no prior data</p>;
  }
  const up = pct >= 0;
  return (
    <p
      className={cn(
        "flex items-center gap-1 text-xs font-medium",
        up ? "text-green-600" : "text-red-600"
      )}
    >
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}% vs prev. month
    </p>
  );
}

async function sumByType(
  type: "income" | "expense",
  start: Date,
  end: Date
): Promise<number> {
  const result = await prisma.accountTransaction.aggregate({
    _sum: { amount: true },
    where: { type, date: { gte: start, lt: end } },
  });
  return toNumber(result._sum.amount ?? 0);
}

export default async function AdminDashboardPage() {
  await requireAdmin();

  const now = new Date();
  const { year, month } = dhakaParts(now);
  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };

  const today = dhakaTodayRange();
  const thisMonth = dhakaMonthRange(year, month);
  const lastMonth = dhakaMonthRange(prevMonth.year, prevMonth.month);

  const [todayIncome, todayExpense, todayCount] = await Promise.all([
    sumByType("income", today.start, today.end),
    sumByType("expense", today.start, today.end),
    prisma.accountTransaction.count({
      where: { date: { gte: today.start, lt: today.end } },
    }),
  ]);
  const todayNet = todayIncome - todayExpense;

  const [monthIncome, monthExpense, prevIncome, prevExpense] = await Promise.all([
    sumByType("income", thisMonth.start, thisMonth.end),
    sumByType("expense", thisMonth.start, thisMonth.end),
    sumByType("income", lastMonth.start, lastMonth.end),
    sumByType("expense", lastMonth.start, lastMonth.end),
  ]);
  const monthNet = monthIncome - monthExpense;
  const prevNet = prevIncome - prevExpense;

  const incomePct = pctChange(monthIncome, prevIncome);
  const expensePct = pctChange(monthExpense, prevExpense);
  const netPct = pctChange(monthNet, prevNet);

  // Daily series — last 30 days (Dhaka dates).
  const dailyStart = new Date(today.start.getTime() - 29 * 24 * 60 * 60 * 1000);
  const dailyTxns = await prisma.accountTransaction.findMany({
    where: { date: { gte: dailyStart, lt: today.end } },
    select: { date: true, amount: true, type: true },
  });
  const dailyMap = new Map<string, { income: number; expense: number }>();
  for (const txn of dailyTxns) {
    const key = dhakaDateKey(txn.date);
    const entry = dailyMap.get(key) ?? { income: 0, expense: 0 };
    if (txn.type === "income") entry.income += toNumber(txn.amount);
    else entry.expense += toNumber(txn.amount);
    dailyMap.set(key, entry);
  }
  const dailySeries: SeriesPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date(today.start.getTime() - i * 24 * 60 * 60 * 1000);
    const key = dhakaDateKey(day);
    const entry = dailyMap.get(key) ?? { income: 0, expense: 0 };
    dailySeries.push({ label: dhakaDayLabel(day), income: entry.income, expense: entry.expense });
  }

  // Monthly series — last 6 months (Dhaka months).
  const monthKeys: { year: number; month: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const totalMonths = (year - 1) * 12 + (month - 1) - i;
    monthKeys.push({
      year: Math.floor(totalMonths / 12) + 1,
      month: (totalMonths % 12) + 1,
    });
  }
  const sixMonthStart = dhakaMonthRange(monthKeys[0].year, monthKeys[0].month).start;
  const monthlyTxns = await prisma.accountTransaction.findMany({
    where: { date: { gte: sixMonthStart, lt: thisMonth.end } },
    select: { date: true, amount: true, type: true },
  });
  const monthlyMap = new Map<string, { income: number; expense: number }>();
  for (const txn of monthlyTxns) {
    const parts = dhakaParts(txn.date);
    const key = `${parts.year}-${parts.month}`;
    const entry = monthlyMap.get(key) ?? { income: 0, expense: 0 };
    if (txn.type === "income") entry.income += toNumber(txn.amount);
    else entry.expense += toNumber(txn.amount);
    monthlyMap.set(key, entry);
  }
  const monthlySeries: SeriesPoint[] = monthKeys.map(({ year: y, month: m }) => {
    const entry = monthlyMap.get(`${y}-${m}`) ?? { income: 0, expense: 0 };
    return { label: MONTH_NAMES[m - 1], income: entry.income, expense: entry.expense };
  });

  // Category breakdown — this month.
  const monthTxns = await prisma.accountTransaction.findMany({
    where: { date: { gte: thisMonth.start, lt: thisMonth.end } },
    select: { amount: true, type: true, category: { select: { name: true } } },
  });
  const incomeByCategory = new Map<string, number>();
  const expenseByCategory = new Map<string, number>();
  for (const txn of monthTxns) {
    const name = txn.category?.name ?? "Uncategorised";
    const map = txn.type === "income" ? incomeByCategory : expenseByCategory;
    map.set(name, (map.get(name) ?? 0) + toNumber(txn.amount));
  }
  const toSlices = (map: Map<string, number>): CategorySlice[] =>
    [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  const incomeSlices = toSlices(incomeByCategory);
  const expenseSlices = toSlices(expenseByCategory);

  // Recent transactions.
  const recent = await prisma.accountTransaction.findMany({
    take: 8,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { category: true },
  });

  type StatCard = {
    title: string;
    value: number;
    icon: LucideIcon;
    iconClass: string;
    valueClass?: string;
    sub?: string | null;
    pct?: number | null;
  };

  const cards: StatCard[] = [
    {
      title: "Today's Income",
      value: todayIncome,
      icon: ArrowUpRight,
      iconClass: "bg-green-100 text-green-700",
      sub: `${todayCount} transaction${todayCount === 1 ? "" : "s"} today`,
    },
    {
      title: "Today's Expense",
      value: todayExpense,
      icon: ArrowDownLeft,
      iconClass: "bg-red-100 text-red-700",
      sub: `${todayCount} transaction${todayCount === 1 ? "" : "s"} today`,
    },
    {
      title: "Today's Net",
      value: todayNet,
      icon: Scale,
      iconClass: todayNet >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
      valueClass: todayNet >= 0 ? "text-green-600" : "text-red-600",
      sub: null,
    },
    {
      title: "Month Income",
      value: monthIncome,
      icon: Wallet,
      iconClass: "bg-blue-100 text-blue-700",
      pct: incomePct,
    },
    {
      title: "Month Expense",
      value: monthExpense,
      icon: ArrowDownLeft,
      iconClass: "bg-amber-100 text-amber-700",
      pct: expensePct,
    },
    {
      title: "Month Net",
      value: monthNet,
      icon: Scale,
      iconClass: monthNet >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
      valueClass: monthNet >= 0 ? "text-green-600" : "text-red-600",
      pct: netPct,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#14213D]">Dashboard</h1>
        <p className="text-sm text-slate-500">
          {MONTH_NAMES[month - 1]} {year} — all figures in BDT (Asia/Dhaka)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{card.title}</p>
                    <p
                      className={cn(
                        "mt-1 text-2xl font-bold text-[#14213D]",
                        card.valueClass
                      )}
                    >
                      {formatBDT(card.value)}
                    </p>
                  </div>
                  <div className={cn("rounded-lg p-2", card.iconClass)}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-2">
                  {card.pct !== undefined ? (
                    <ComparisonLine pct={card.pct} />
                  ) : card.sub ? (
                    <p className="text-xs text-slate-400">{card.sub}</p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      {todayCount} transaction{todayCount === 1 ? "" : "s"} today
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Income vs Expense</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyIncomeExpenseChart data={dailySeries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monthly Income vs Expense</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyIncomeExpenseChart data={monthlySeries} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>
              {MONTH_NAMES[month - 1]} {year}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBreakdownChart expenses={expenseSlices} income={incomeSlices} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Latest 8 transactions</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/accounts">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-slate-500">
                No transactions yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(txn.date)}
                      </TableCell>
                      <TableCell>{txn.category?.name ?? "—"}</TableCell>
                      <TableCell className="max-w-[180px] truncate">
                        {txn.description}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            txn.type === "income"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : "bg-red-100 text-red-800 hover:bg-red-100"
                          }
                        >
                          {txn.type === "income" ? "Income" : "Expense"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium",
                          txn.type === "income" ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {txn.type === "income" ? "+" : "−"}
                        {formatBDT(toNumber(txn.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
