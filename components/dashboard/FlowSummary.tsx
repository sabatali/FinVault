"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";

interface FlowSummaryProps {
  incomeTotal: number;
  expenseTotal: number;
  currency?: string;
}

export function FlowSummary({
  incomeTotal,
  expenseTotal,
}: FlowSummaryProps) {
  const { format } = useMoney();
  const net = incomeTotal - expenseTotal;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-[#e4e7ee] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#5a6072]">
          Income
        </p>
        <p
          className="mt-2 text-2xl font-bold text-green-700"
          aria-label={`Period income ${format(incomeTotal)}`}
        >
          {format(incomeTotal)}
        </p>
      </div>
      <div className="rounded-xl border border-[#e4e7ee] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#5a6072]">
          Expenses
        </p>
        <p
          className="mt-2 text-2xl font-bold text-red-600"
          aria-label={`Period expenses ${format(expenseTotal)}`}
        >
          {format(expenseTotal)}
        </p>
      </div>
      <div className="rounded-xl border border-[#e4e7ee] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#5a6072]">
          Net flow
        </p>
        <p
          className={`mt-2 text-2xl font-bold ${
            net < 0 ? "text-red-600" : "text-[#1a1d29]"
          }`}
          aria-label={`Net flow ${format(net)}`}
        >
          {format(net)}
        </p>
      </div>
    </div>
  );
}
