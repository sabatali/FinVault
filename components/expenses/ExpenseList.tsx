"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DeleteExpenseDialog } from "@/components/expenses/DeleteExpenseDialog";
import { formatDateTime } from "@/lib/format";
import type { ExpensePublic } from "@/models/Expense";

interface ExpenseListProps {
  initialExpenses: ExpensePublic[];
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  initialFilters: {
    accountId: string;
    categoryId: string;
    from: string;
    to: string;
  };
}

export function ExpenseList({
  initialExpenses,
  accounts,
  categories,
  initialFilters,
}: ExpenseListProps) {
  const { format } = useMoney();
  const router = useRouter();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [accountFilter, setAccountFilter] = useState(initialFilters.accountId);
  const [categoryFilter, setCategoryFilter] = useState(initialFilters.categoryId);
  const [from, setFrom] = useState(initialFilters.from);
  const [to, setTo] = useState(initialFilters.to);
  const [banner, setBanner] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpensePublic | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function applyFilters() {
    const params = new URLSearchParams();
    if (accountFilter) {
      params.set("accountId", accountFilter);
    }
    if (categoryFilter) {
      params.set("categoryId", categoryFilter);
    }
    if (from) {
      params.set("from", from);
    }
    if (to) {
      params.set("to", to);
    }
    const query = params.toString();
    router.push(query ? `/expenses?${query}` : "/expenses");
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/expenses/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setDeleteError(data.error ?? "Unable to delete expense.");
        return;
      }

      const deletedId = deleteTarget.id;
      setDeleteTarget(null);
      setBanner("Expense deleted.");
      setExpenses((current) => current.filter((item) => item.id !== deletedId));
      router.refresh();
    } catch {
      setDeleteError("Network error. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#e4e7ee] bg-white p-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label htmlFor="filter-account" className="block text-xs font-semibold text-[#5a6072]">
            Account
          </label>
          <select
            id="filter-account"
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="filter-category" className="block text-xs font-semibold text-[#5a6072]">
            Category
          </label>
          <select
            id="filter-category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-from" className="block text-xs font-semibold text-[#5a6072]">
            From
          </label>
          <input
            id="filter-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1 rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="filter-to" className="block text-xs font-semibold text-[#5a6072]">
            To
          </label>
          <input
            id="filter-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-1 rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={applyFilters}
          className="rounded-lg bg-[#1a1d29] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2f5fdc]"
        >
          Apply
        </button>
      </div>

      {banner ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {banner}
        </div>
      ) : null}

      {expenses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e4e7ee] bg-white p-10 text-center">
          <p className="font-medium text-[#1a1d29]">No expenses yet.</p>
          <p className="mt-2 text-sm text-[#5a6072]">
            Record your first purchase.
          </p>
          <Link
            href="/expenses/new"
            className="mt-6 inline-flex rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae]"
          >
            Add expense
          </Link>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-[#e4e7ee] bg-white md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#e4e7ee] bg-[#f4f6fb] text-[#5a6072]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Account</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-[#e4e7ee] last:border-0">
                    <td className="px-4 py-3 text-[#5a6072]">
                      {formatDateTime(expense.occurredAt)}
                    </td>
                    <td className="px-4 py-3 text-[#1a1d29]">
                      {expense.accountName ?? "Account"}
                    </td>
                    <td className="px-4 py-3 text-[#5a6072]">
                      {expense.categoryName ?? "Uncategorized"}
                    </td>
                    <td className="px-4 py-3 text-[#1a1d29]">
                      {expense.description || "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-right font-medium text-red-600"
                      aria-label={`Debit ${format(expense.amount)}`}
                    >
                      {format(expense.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/expenses/${expense.id}/edit`}
                          className="text-sm font-medium text-[#2f5fdc] hover:underline"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(expense);
                          }}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {expenses.map((expense) => (
              <article
                key={expense.id}
                className="rounded-xl border border-[#e4e7ee] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-[#1a1d29]">
                      {expense.description || "Expense"}
                    </h2>
                    <p className="mt-1 text-xs text-[#5a6072]">
                      {expense.accountName ?? "Account"} ·{" "}
                      {expense.categoryName ?? "Uncategorized"} ·{" "}
                      {formatDateTime(expense.occurredAt)}
                    </p>
                  </div>
                  <p
                    className="text-lg font-bold text-red-600"
                    aria-label={`Debit ${format(expense.amount)}`}
                  >
                    {format(expense.amount)}
                  </p>
                </div>
                <div className="mt-4 flex gap-3">
                  <Link
                    href={`/expenses/${expense.id}/edit`}
                    className="text-sm font-medium text-[#2f5fdc]"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget(expense);
                    }}
                    className="text-sm font-medium text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <DeleteExpenseDialog
        description={deleteTarget?.description ?? ""}
        open={Boolean(deleteTarget)}
        loading={deleteLoading}
        error={deleteError}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => {
          if (!deleteLoading) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      />
    </>
  );
}
