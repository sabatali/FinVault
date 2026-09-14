"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { CategorySelect } from "@/components/categories/CategorySelect";
import type { AccountPublic } from "@/lib/account-types";
import { toDisplay } from "@/lib/fx";
import type { IncomePublic } from "@/models/Income";

function toDateInputValue(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayInputValue(): string {
  return toDateInputValue(new Date());
}

interface IncomeFormProps {
  mode: "create" | "edit";
  incomeId?: string;
  initialValues?: Pick<
    IncomePublic,
    "account" | "amount" | "description" | "occurredAt" | "category"
  >;
  defaultAccountId?: string;
}

export function IncomeForm({
  mode,
  incomeId,
  initialValues,
  defaultAccountId,
}: IncomeFormProps) {
  const { format, rates } = useMoney();
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountPublic[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountId, setAccountId] = useState(
    initialValues?.account ?? defaultAccountId ?? "",
  );
  const [amount, setAmount] = useState(
    initialValues ? String(initialValues.amount) : "",
  );
  const amountHydratedRef = useRef(false);
  const [occurredAt, setOccurredAt] = useState(
    initialValues ? toDateInputValue(initialValues.occurredAt) : todayInputValue(),
  );
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [categoryId, setCategoryId] = useState(initialValues?.category ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAccounts() {
      setAccountsLoading(true);
      try {
        const response = await fetch("/api/accounts", { credentials: "include" });
        const data = (await response.json()) as {
          accounts?: AccountPublic[];
          error?: string;
        };

        if (!response.ok) {
          if (!cancelled) {
            setError(data.error ?? "Unable to load accounts.");
          }
          return;
        }

        if (!cancelled) {
          const list = data.accounts ?? [];
          setAccounts(list);
          setAccountId((current) => current || list[0]?.id || "");
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load accounts.");
        }
      } finally {
        if (!cancelled) {
          setAccountsLoading(false);
        }
      }
    }

    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId),
    [accounts, accountId],
  );

  useEffect(() => {
    if (
      amountHydratedRef.current ||
      mode !== "edit" ||
      !initialValues ||
      accounts.length === 0
    ) {
      return;
    }
    const account = accounts.find((row) => row.id === initialValues.account);
    if (!account) {
      return;
    }
    amountHydratedRef.current = true;
    if (account.currency === "PKR") {
      return;
    }
    const converted = toDisplay(initialValues.amount, account.currency, rates);
    setAmount(String(converted.amount));
  }, [accounts, initialValues, mode, rates]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    const payload = {
      accountId,
      amount: Number(amount),
      occurredAt,
      description,
      categoryId: categoryId || null,
    };

    try {
      if (mode === "create") {
        const response = await fetch("/api/income", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        const data = (await response.json()) as {
          error?: string;
          fields?: Record<string, string>;
        };

        if (!response.ok) {
          if (data.fields) {
            setFieldErrors(data.fields);
          }
          setError(data.error ?? "Unable to create income.");
          return;
        }

        router.push("/income?created=1");
        router.refresh();
        return;
      }

      if (!incomeId) {
        setError("Missing income id.");
        return;
      }

      const response = await fetch(`/api/income/${incomeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        fields?: Record<string, string>;
      };

      if (!response.ok) {
        if (data.fields) {
          setFieldErrors(data.fields);
        }
        setError(data.error ?? "Unable to update income.");
        return;
      }

      router.push("/income?updated=1");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (accountsLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-4 animate-pulse">
        <div className="h-10 rounded-lg bg-[#e4e7ee]" />
        <div className="h-10 rounded-lg bg-[#e4e7ee]" />
        <div className="h-10 rounded-lg bg-[#e4e7ee]" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-dashed border-[#e4e7ee] bg-white p-8 text-center">
        <p className="font-medium text-[#1a1d29]">No accounts yet.</p>
        <p className="mt-2 text-sm text-[#5a6072]">
          Create an account before recording income.
        </p>
        <Link
          href="/accounts/new"
          className="mt-6 inline-flex rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae]"
        >
          Add account
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-4" noValidate>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <div>
        <label htmlFor="income-account" className="block text-sm font-medium text-[#1a1d29]">
          Account
        </label>
        <select
          id="income-account"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          className="mt-1 w-full rounded-lg border border-[#e4e7ee] bg-white px-3 py-2 text-sm text-[#1a1d29]"
          required
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({format(account.cachedBalance)})
            </option>
          ))}
        </select>
        {fieldErrors.accountId ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.accountId}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="income-amount" className="block text-sm font-medium text-[#1a1d29]">
          Amount ({selectedAccount?.currency ?? "PKR"})
        </label>
        <input
          id="income-amount"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm text-[#1a1d29]"
          required
        />
        {fieldErrors.amount ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.amount}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="income-date" className="block text-sm font-medium text-[#1a1d29]">
          Date
        </label>
        <input
          id="income-date"
          type="date"
          value={occurredAt}
          onChange={(event) => setOccurredAt(event.target.value)}
          className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm text-[#1a1d29]"
          required
        />
        {fieldErrors.occurredAt ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.occurredAt}</p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="income-description"
          className="block text-sm font-medium text-[#1a1d29]"
        >
          Description <span className="font-normal text-[#5a6072]">(optional)</span>
        </label>
        <input
          id="income-description"
          type="text"
          maxLength={200}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm text-[#1a1d29]"
          placeholder="Salary, refund, gift…"
        />
        {fieldErrors.description ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
        ) : null}
      </div>

      <CategorySelect
        id="income-category"
        kind="income"
        value={categoryId}
        onChange={setCategoryId}
        error={fieldErrors.categoryId}
      />

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Link
          href="/income"
          className="inline-flex items-center justify-center rounded-lg border border-[#e4e7ee] px-4 py-2.5 text-sm font-medium text-[#1a1d29] hover:bg-[#f4f6fb]"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae] disabled:opacity-70"
        >
          {loading
            ? mode === "create"
              ? "Saving…"
              : "Updating…"
            : mode === "create"
              ? "Add income"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
