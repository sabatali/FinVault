"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import Link from "next/link";

import type { GroupExpensePublic } from "@/models/GroupExpense";

interface GroupExpenseListProps {
  groupId: string;
  expenses: GroupExpensePublic[];
}

function formatOccurredAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function GroupExpenseList({ groupId, expenses }: GroupExpenseListProps) {
  const { format } = useMoney();
  if (expenses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e4e7ee] bg-[#fafbfd] px-4 py-4 text-center">
        <p className="text-sm text-[#5a6072]">No group expenses yet.</p>
        <Link
          href={`/groups/${groupId}/expenses/new`}
          className="mt-2 inline-flex text-sm font-semibold text-[#2f5fdc] hover:underline"
        >
          Add the first expense
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[#e4e7ee] overflow-hidden rounded-xl border border-[#e4e7ee] bg-white">
      {expenses.map((expense) => {
        const shareSummary = expense.participants
          .map((participant) => {
            const name = participant.displayName ?? "Member";
            return `${name} ${format(participant.shareAmount)}`;
          })
          .join(" · ");

        return (
          <li key={expense.id} className="px-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-[#1a1d29]">
                  <Link
                    href={`/groups/${groupId}/expenses/${expense.id}`}
                    className="hover:text-[#2f5fdc] hover:underline"
                  >
                    {expense.description}
                  </Link>
                </p>
                <p className="mt-1 text-sm text-[#5a6072]">
                  {formatOccurredAt(expense.occurredAt)}
                  {" · Paid by "}
                  {expense.payerDisplayName ?? "Member"}
                  {expense.payerAccountName
                    ? ` (${expense.payerAccountName})`
                    : expense.transactionId
                      ? ""
                      : " · guest (no debit)"}
                  {" · "}
                  {expense.splitType === "equal" ? "Equal split" : "Manual split"}
                </p>
                <p className="mt-1 text-xs text-[#5a6072]">{shareSummary}</p>
              </div>
              <p className="shrink-0 text-base font-bold text-[#1a1d29]">
                {format(expense.amount)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function GroupExpenseListSkeleton() {
  return (
    <div className="space-y-0 overflow-hidden rounded-xl border border-[#e4e7ee] bg-white animate-pulse">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="border-b border-[#e4e7ee] px-4 py-4 last:border-0"
        >
          <div className="h-4 w-48 rounded bg-[#e4e7ee]" />
          <div className="mt-2 h-3 w-72 rounded bg-[#e4e7ee]" />
        </div>
      ))}
    </div>
  );
}
