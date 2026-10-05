"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import Link from "next/link";
import { useCallback, useState } from "react";

import { formatDateTime } from "@/lib/format";
import { getSourceTypeLabel } from "@/lib/ledger-labels";
import type { TransactionPublic } from "@/models/Transaction";

interface TransactionsResponse {
  transactions?: TransactionPublic[];
  total?: number;
  page?: number;
  limit?: number;
  error?: string;
}

export interface TransactionTableInitialData {
  transactions: TransactionPublic[];
  total: number;
  page: number;
  limit: number;
}

interface TransactionTableProps {
  accountId: string;
  initialData: TransactionTableInitialData;
}

function formatEntryAmount(amount: number, format: (n: number) => string): string {
  return format(amount);
}

function SourceCell({ transaction }: { transaction: TransactionPublic }) {
  const label = getSourceTypeLabel(transaction.sourceType);
  if (transaction.sourceHref) {
    return (
      <Link
        href={transaction.sourceHref}
        className="font-medium text-[#2f5fdc] hover:underline"
      >
        {label}
      </Link>
    );
  }
  return <>{label}</>;
}

function EmptyHistory() {
  return (
    <div className="rounded-xl border border-dashed border-[#e4e7ee] bg-white p-10 text-center">
      <p className="font-medium text-[#1a1d29]">No transactions yet.</p>
      <p className="mt-2 text-sm text-[#5a6072]">
        Add income or expenses to see them here.
      </p>
    </div>
  );
}

export function TransactionTable({ accountId, initialData }: TransactionTableProps) {
  const { format } = useMoney();
  const [transactions, setTransactions] = useState(initialData.transactions);
  const [page, setPage] = useState(initialData.page);
  const [total, setTotal] = useState(initialData.total);
  const [limit] = useState(initialData.limit);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/accounts/${accountId}/transactions?page=${page + 1}&limit=${limit}`,
        { credentials: "include" },
      );
      const data = (await response.json()) as TransactionsResponse;

      if (!response.ok) {
        setError(data.error ?? "Unable to load transactions.");
        return;
      }

      const rows = data.transactions ?? [];
      setTotal(data.total ?? total);
      setPage(data.page ?? page + 1);
      setTransactions((current) => [...current, ...rows]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }, [accountId, limit, page, total]);

  if (transactions.length === 0) {
    return <EmptyHistory />;
  }

  const hasMore = transactions.length < total;

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="hidden overflow-hidden rounded-xl border border-[#e4e7ee] bg-white md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#e4e7ee] bg-[#f4f6fb] text-[#5a6072]">
            <tr>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold text-right">Debit</th>
              <th className="px-4 py-3 font-semibold text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => {
              const isDebit = transaction.entryType === "debit";
              const isCredit = transaction.entryType === "credit";
              const amountText = formatEntryAmount(
                transaction.amount,
                format,
              );

              return (
                <tr
                  key={transaction.id}
                  className="border-b border-[#e4e7ee] last:border-0"
                >
                  <td className="px-4 py-3 text-[#5a6072]">
                    {formatDateTime(transaction.occurredAt)}
                  </td>
                  <td className="px-4 py-3 text-[#1a1d29]">
                    <p>{transaction.description || "—"}</p>
                    {transaction.groupExpense ? (
                      <p className="mt-1 text-xs text-[#5a6072]">
                        Your share {format(transaction.groupExpense.yourShare)}
                        {" · "}
                        {format(transaction.groupExpense.othersShare)} to be
                        settled by others
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[#5a6072]">
                    <SourceCell transaction={transaction} />
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      isDebit ? "text-red-600" : "text-[#5a6072]"
                    }`}
                    aria-label={isDebit ? `Debit ${amountText}` : undefined}
                  >
                    {isDebit ? amountText : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      isCredit ? "text-green-700" : "text-[#5a6072]"
                    }`}
                    aria-label={isCredit ? `Credit ${amountText}` : undefined}
                  >
                    {isCredit ? amountText : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {transactions.map((transaction) => {
          const isDebit = transaction.entryType === "debit";
          const amountText = formatEntryAmount(
            transaction.amount,
            format,
          );

          return (
            <article
              key={transaction.id}
              className="rounded-xl border border-[#e4e7ee] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[#1a1d29]">
                    {transaction.description ||
                      getSourceTypeLabel(transaction.sourceType)}
                  </p>
                  <p className="mt-1 text-xs text-[#5a6072]">
                    {formatDateTime(transaction.occurredAt)} ·{" "}
                    <SourceCell transaction={transaction} />
                  </p>
                  {transaction.groupExpense ? (
                    <p className="mt-1 text-xs text-[#5a6072]">
                      Your share {format(transaction.groupExpense.yourShare)}
                      {" · "}
                      {format(transaction.groupExpense.othersShare)} to be
                      settled by others
                    </p>
                  ) : null}
                </div>
                <p
                  className={`text-base font-bold ${
                    isDebit ? "text-red-600" : "text-green-700"
                  }`}
                  aria-label={`${isDebit ? "Debit" : "Credit"} ${amountText}`}
                >
                  {isDebit ? "−" : "+"}
                  {amountText}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className="rounded-lg border border-[#e4e7ee] bg-white px-4 py-2.5 text-sm font-semibold text-[#2f5fdc] hover:bg-[#f4f6fb] disabled:opacity-60"
          >
            {loadingMore
              ? "Loading…"
              : `Load more (${transactions.length} of ${total})`}
          </button>
        </div>
      ) : total > limit ? (
        <p className="text-center text-xs text-[#5a6072]">
          Showing all {total} transactions.
        </p>
      ) : null}
    </div>
  );
}
