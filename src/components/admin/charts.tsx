"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBDT } from "@/lib/utils";

export type SeriesPoint = {
  label: string;
  income: number;
  expense: number;
};

export type CategorySlice = {
  name: string;
  value: number;
};

const PIE_COLORS = [
  "#2563EB",
  "#F59E0B",
  "#10B981",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
];

function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-sm shadow-md">
      {label !== undefined && label !== "" && (
        <p className="mb-1 font-semibold text-[#14213D]">{label}</p>
      )}
      {payload.map((entry) => (
        <p key={entry.name} className="text-slate-600">
          {entry.name}:{" "}
          <span className="font-medium text-slate-900">
            {formatBDT(Number(entry.value ?? 0))}
          </span>
        </p>
      ))}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-slate-500">
      {message}
    </div>
  );
}

export function DailyIncomeExpenseChart({ data }: { data: SeriesPoint[] }) {
  const hasData = data.some((d) => d.income > 0 || d.expense > 0);
  if (!hasData) return <EmptyChart message="No transactions in the last 30 days." />;
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            tickFormatter={(v: number) => `৳${v.toLocaleString("en-US")}`}
          />
          <Tooltip content={<MoneyTooltip />} />
          <Legend />
          <Bar dataKey="income" name="Income" fill="#2563EB" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Expense" fill="#F59E0B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyIncomeExpenseChart({ data }: { data: SeriesPoint[] }) {
  const hasData = data.some((d) => d.income > 0 || d.expense > 0);
  if (!hasData) return <EmptyChart message="No transactions in the last 6 months." />;
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            tickFormatter={(v: number) => `৳${v.toLocaleString("en-US")}`}
          />
          <Tooltip content={<MoneyTooltip />} />
          <Legend />
          <Bar dataKey="income" name="Income" fill="#2563EB" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Expense" fill="#F59E0B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBreakdownChart({
  expenses,
  income,
}: {
  expenses: CategorySlice[];
  income: CategorySlice[];
}) {
  const expenseTotal = expenses.reduce((sum, s) => sum + s.value, 0);
  const incomeTotal = income.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="space-y-6">
      {expenseTotal > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">
            Expenses by category — {formatBDT(expenseTotal)}
          </p>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenses}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {expenses.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatBDT(Number(value))}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-slate-500">
          No expenses this month.
        </p>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">
          Income by category — {formatBDT(incomeTotal)}
        </p>
        {income.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-slate-500">
            No income this month.
          </p>
        ) : (
          <ul className="space-y-2">
            {income.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between rounded-md bg-[#F8FAFC] px-3 py-2 text-sm"
              >
                <span className="text-slate-700">{item.name}</span>
                <span className="font-medium text-slate-900">
                  {formatBDT(item.value)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
