"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import type { SpendByCategoryRow } from "@/lib/dashboard-personal";

interface SpendByCategoryProps {
  rows: SpendByCategoryRow[];
  expenseTotal: number;
  currency?: string;
  groupSpendByGroup?: Array<{
    groupId: string;
    groupName: string;
    amount: number;
  }>;
}

export function SpendByCategory({
  rows,
  expenseTotal,
  groupSpendByGroup = [],
}: SpendByCategoryProps) {
  const { format } = useMoney();

  if (expenseTotal <= 0 || rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e4e7ee] bg-white p-8 text-center">
        <p className="font-medium text-[#1a1d29]">No spending in this period.</p>
        <p className="mt-2 text-sm text-[#5a6072]">
          Add expenses to see a category breakdown.
        </p>
      </div>
    );
  }

  const maxAmount = Math.max(...rows.map((row) => row.amount), 0);

  return (
    <div className="rounded-xl border border-[#e4e7ee] bg-white p-5">
      <h2 className="text-lg font-semibold text-[#1a1d29]">Spend by category</h2>
      <p className="mt-1 text-sm text-[#5a6072]">
        Total spent {format(expenseTotal)}
      </p>

      <ul className="mt-5 space-y-4">
        {rows.map((row) => {
          const widthPercent =
            maxAmount > 0 ? Math.max((row.amount / maxAmount) * 100, 2) : 0;

          return (
            <li key={`${row.categoryId ?? "null"}-${row.name}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span
                  className="font-medium text-[#1a1d29]"
                  title={
                    row.name === "Group expenses" && groupSpendByGroup.length > 0
                      ? groupSpendByGroup
                          .map(
                            (group) =>
                              `${group.groupName}: ${format(group.amount)}`,
                          )
                          .join(" · ")
                      : undefined
                  }
                >
                  {row.name}
                </span>
                <span className="text-[#5a6072]">
                  {format(row.amount)} · {row.percent.toFixed(1)}%
                </span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef1f8]"
                role="presentation"
              >
                <div
                  className="h-full rounded-full bg-[#2f5fdc]"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
