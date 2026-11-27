import { db as prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { toNumber } from "@/lib/utils";
import ReportView, {
  type CategoryBreakdown,
  type DailyPoint,
  type ReportTransaction,
  type ReportView as ReportViewType,
} from "./ReportView";

export const dynamic = "force-dynamic";

type SearchParams = {
  view?: string;
  date?: string;
  year?: string;
  month?: string;
  from?: string;
  to?: string;
};

function dhakaDateString(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
}

function dhakaYearMonth(d: Date = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "numeric",
  }).formatToParts(d);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { year, month };
}

function isValidDateStr(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00.000Z`).getTime());
}

function dayStart(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

function monthName(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const view: ReportViewType =
    sp.view === "monthly" || sp.view === "range" ? sp.view : "daily";

  const today = dhakaDateString();
  const { year: currentYear, month: currentMonth } = dhakaYearMonth();

  let start: Date;
  let endExclusive: Date;
  let periodLabel: string;
  let date = today;
  let year = currentYear;
  let month = currentMonth;
  let from = today;
  let to = today;

  if (view === "daily") {
    date = isValidDateStr(sp.date) ? sp.date : today;
    start = dayStart(date);
    endExclusive = addDays(start, 1);
    periodLabel = new Date(`${date}T00:00:00.000Z`).toLocaleDateString(
      "en-GB",
      { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
    );
  } else if (view === "monthly") {
    year = Number(sp.year) || currentYear;
    month = Number(sp.month) || currentMonth;
    if (month < 1 || month > 12) month = currentMonth;
    start = new Date(Date.UTC(year, month - 1, 1));
    endExclusive = new Date(Date.UTC(year, month, 1));
    periodLabel = monthName(year, month);
  } else {
    const firstOfMonth = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
    from = isValidDateStr(sp.from) ? sp.from : firstOfMonth;
    to = isValidDateStr(sp.to) ? sp.to : today;
    if (from > to) [from, to] = [to, from];
    start = dayStart(from);
    endExclusive = addDays(dayStart(to), 1);
    periodLabel = `${from} to ${to}`;
  }

  const where = { date: { gte: start, lt: endExclusive } };

  const [transactions, totalsByType, incomeByCat, expenseByCat, settings] =
    await Promise.all([
      prisma.accountTransaction.findMany({
        where,
        include: { category: true },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      prisma.accountTransaction.groupBy({
        by: ["type"],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.accountTransaction.groupBy({
        by: ["categoryId"],
        where: { ...where, type: "income" },
        _sum: { amount: true },
      }),
      prisma.accountTransaction.groupBy({
        by: ["categoryId"],
        where: { ...where, type: "expense" },
        _sum: { amount: true },
      }),
      getSettings(),
    ]);

  const totalIncome = toNumber(
    totalsByType.find((t) => t.type === "income")?._sum.amount ?? 0
  );
  const totalExpense = toNumber(
    totalsByType.find((t) => t.type === "expense")?._sum.amount ?? 0
  );
  const transactionCount = totalsByType.reduce(
    (sum, t) => sum + t._count._all,
    0
  );

  const categories = await prisma.accountCategory.findMany({
    select: { id: true, name: true },
  });
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  function toBreakdown(
    rows: { categoryId: string; _sum: { amount: unknown } }[],
    total: number
  ): CategoryBreakdown[] {
    return rows
      .map((r) => ({
        name: categoryName.get(r.categoryId) ?? "Unknown",
        amount: toNumber(r._sum.amount ?? 0),
        share: total > 0 ? (toNumber(r._sum.amount ?? 0) / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  const incomeByCategory = toBreakdown(incomeByCat, totalIncome);
  const expenseByCategory = toBreakdown(expenseByCat, totalExpense);

  const reportTransactions: ReportTransaction[] = transactions.map((tx) => ({
    id: tx.id,
    date: tx.date.toISOString().slice(0, 10),
    category: tx.category.name,
    description: tx.description,
    type: tx.type as "income" | "expense",
    paymentMethod: tx.paymentMethod,
    amount: toNumber(tx.amount),
    reference: tx.reference,
  }));

  // Daily breakdown: every day in the period (single day for daily view).
  const dailyMap = new Map<string, { income: number; expense: number }>();
  for (const tx of reportTransactions) {
    const entry = dailyMap.get(tx.date) ?? { income: 0, expense: 0 };
    if (tx.type === "income") entry.income += tx.amount;
    else entry.expense += tx.amount;
    dailyMap.set(tx.date, entry);
  }
  const daily: DailyPoint[] = [];
  for (let d = new Date(start); d < endExclusive; d = addDays(d, 1)) {
    const key = d.toISOString().slice(0, 10);
    const entry = dailyMap.get(key) ?? { income: 0, expense: 0 };
    daily.push({
      date: key,
      label: d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
      income: Math.round(entry.income * 100) / 100,
      expense: Math.round(entry.expense * 100) / 100,
    });
    // Keep the chart readable for very long ranges.
    if (daily.length >= 366) break;
  }

  return (
    <ReportView
      shopName={settings.shopName ?? "Kazi Gift and Print House"}
      view={view}
      date={date}
      year={year}
      month={month}
      from={from}
      to={to}
      periodLabel={periodLabel}
      totals={{
        income: totalIncome,
        expense: totalExpense,
        net: totalIncome - totalExpense,
        count: transactionCount,
      }}
      incomeByCategory={incomeByCategory}
      expenseByCategory={expenseByCategory}
      daily={daily}
      transactions={reportTransactions}
    />
  );
}
