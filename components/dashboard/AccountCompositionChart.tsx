"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import { Component, type ReactNode, useId } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { DashboardAccountRow } from "@/lib/dashboard";

const COLORS = [
  "#2f5fdc",
  "#1e3fae",
  "#5b8def",
  "#0f766e",
  "#b45309",
  "#be123c",
  "#6d28d9",
  "#334155",
];

interface AccountCompositionChartProps {
  accounts: DashboardAccountRow[];
  currency?: string;
}

class ChartBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export function AccountCompositionChart({
  accounts,
}: AccountCompositionChartProps) {
  const { format } = useMoney();
  const titleId = useId();

  const positive = accounts
    .filter((account) => account.cachedBalance > 0)
    .map((account) => ({
      id: account.id,
      name: account.name,
      value: account.cachedBalance,
    }));

  if (positive.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e4e7ee] bg-white p-6 text-center text-sm text-[#5a6072]">
        No positive account balances to chart.
      </div>
    );
  }

  const total = positive.reduce((sum, row) => sum + row.value, 0);

  const table = (
    <table className="mt-4 w-full text-left text-sm">
      <caption className="sr-only">Account balance composition</caption>
      <thead>
        <tr className="border-b border-[#e4e7ee] text-[#5a6072]">
          <th scope="col" className="py-2 font-medium">
            Account
          </th>
          <th scope="col" className="py-2 font-medium">
            Balance
          </th>
          <th scope="col" className="py-2 font-medium">
            Share
          </th>
        </tr>
      </thead>
      <tbody>
        {positive.map((row, index) => (
          <tr key={row.id} className="border-b border-[#e4e7ee] last:border-0">
            <td className="py-2">
              <span
                className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                aria-hidden
              />
              {row.name}
            </td>
            <td className="py-2">{format(row.value)}</td>
            <td className="py-2 text-[#5a6072]">
              {total > 0 ? ((row.value / total) * 100).toFixed(1) : "0.0"}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-xl border border-[#e4e7ee] bg-white p-5"
    >
      <h2 id={titleId} className="text-lg font-semibold text-[#1a1d29]">
        Account composition
      </h2>
      <p className="mt-1 text-sm text-[#5a6072]">
        Share of positive balances across your accounts.
      </p>

      <ChartBoundary
        fallback={
          <p className="mt-3 text-sm text-[#5a6072]">
            Chart unavailable — balances are listed below.
          </p>
        }
      >
        <div
          className="mt-4 h-56 w-full"
          role="img"
          aria-label="Account pie chart"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={positive}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={80}
                paddingAngle={2}
              >
                {positive.map((entry, index) => (
                  <Cell
                    key={entry.id}
                    fill={COLORS[index % COLORS.length]}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) =>
                  format(typeof value === "number" ? value : Number(value))
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartBoundary>

      {table}
    </section>
  );
}
