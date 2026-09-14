"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DeleteGroupExpenseDialog } from "@/components/groups/DeleteGroupExpenseDialog";
import type { GroupExpensePublic } from "@/models/GroupExpense";

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

interface GroupExpenseDetailProps {
  groupId: string;
  groupName: string;
  expense: GroupExpensePublic;
  canManage: boolean;
  updatedBanner?: boolean;
}

export function GroupExpenseDetail({
  groupId,
  groupName,
  expense,
  canManage,
  updatedBanner = false,
}: GroupExpenseDetailProps) {
  const { format } = useMoney();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const debitLine = expense.transactionId
    ? `Debited from ${expense.payerAccountName ?? "account"} · ${format(expense.amount)}`
    : "Guest payer — no account debit";

  async function handleDeleteConfirm() {
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const response = await fetch(
        `/api/groups/${groupId}/expenses/${expense.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setDeleteError(data.error ?? "Unable to delete expense.");
        return;
      }

      router.push(`/groups/${groupId}?expenseDeleted=1`);
      router.refresh();
    } catch {
      setDeleteError("Network error. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/groups/${groupId}`}
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to {groupName}
        </Link>
        {updatedBanner ? (
          <div
            role="status"
            className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            Expense updated. Ledger debit refreshed.
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1d29]">
              {expense.description}
            </h1>
            <p className="mt-2 text-[#5a6072]">
              {formatOccurredAt(expense.occurredAt)} ·{" "}
              {expense.splitType === "equal" ? "Equal split" : "Manual split"}
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/groups/${groupId}/expenses/${expense.id}/edit`}
                className="rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm font-medium text-[#1a1d29] hover:bg-[#f5f6f9]"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-[#e4e7ee] bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#5a6072]">Total</p>
            <p className="text-2xl font-bold text-[#1a1d29]">
              {format(expense.amount)}
            </p>
          </div>
          <p
            className={
              expense.transactionId
                ? "text-sm font-medium text-[#1a1d29]"
                : "text-sm font-medium text-amber-800"
            }
          >
            {debitLine}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-[#5a6072]">Paid by</p>
          <p className="mt-1 text-sm text-[#1a1d29]">
            {expense.payerDisplayName ?? "Member"}
            {expense.payerAccountName ? ` · ${expense.payerAccountName}` : ""}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-[#5a6072]">Shares</p>
          <ul className="mt-2 divide-y divide-[#e4e7ee] rounded-lg border border-[#e4e7ee]">
            {expense.participants.map((participant) => (
              <li
                key={participant.memberId}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <span className="text-[#1a1d29]">
                  {participant.displayName ?? "Member"}
                </span>
                <span className="font-medium text-[#1a1d29]">
                  {format(participant.shareAmount)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {expense.payerAccountId && expense.transactionId ? (
          <p className="text-xs text-[#5a6072]">
            Ledger: one{" "}
            <Link
              href={`/accounts/${expense.payerAccountId}`}
              className="font-medium text-[#2f5fdc] hover:underline"
            >
              account debit
            </Link>{" "}
            tagged <code className="text-[11px]">group_expense</code>.
          </p>
        ) : null}
      </div>

      <DeleteGroupExpenseDialog
        description={expense.description}
        amount={expense.amount}
        currency={expense.currency}
        hasLedgerDebit={Boolean(expense.transactionId)}
        open={deleteOpen}
        loading={deleteLoading}
        error={deleteError}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => {
          if (!deleteLoading) {
            setDeleteOpen(false);
            setDeleteError(null);
          }
        }}
      />
    </div>
  );
}
