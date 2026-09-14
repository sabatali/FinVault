"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { useMoney } from "@/components/currency/CurrencyProvider";
import {
  ACCOUNT_CURRENCIES,
  ACCOUNT_TYPES,
  type AccountCurrency,
  type AccountPublic,
  type AccountType,
} from "@/lib/account-types";
import { ACCOUNT_TYPE_LABELS } from "@/lib/format";
import { toBase } from "@/lib/fx";

interface AccountFormProps {
  mode: "create" | "edit";
  accountId?: string;
  initialValues?: Pick<AccountPublic, "name" | "type" | "currency">;
  currencyLocked?: boolean;
}

export function AccountForm({
  mode,
  accountId,
  initialValues,
  currencyLocked = false,
}: AccountFormProps) {
  const router = useRouter();
  const { rates, format } = useMoney();
  const [name, setName] = useState(initialValues?.name ?? "");
  const [type, setType] = useState<AccountType>(initialValues?.type ?? "bank");
  const [currency, setCurrency] = useState<AccountCurrency>(() => {
    const initial = initialValues?.currency;
    if (initial && ACCOUNT_CURRENCIES.includes(initial as AccountCurrency)) {
      return initial as AccountCurrency;
    }
    return "PKR";
  });
  const [openingBalance, setOpeningBalance] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const openingValue = Number(openingBalance);
  const showNegativeWarning =
    mode === "create" &&
    openingBalance !== "" &&
    Number.isFinite(openingValue) &&
    openingValue < 0;

  let openingPkrPreview: number | null = null;
  if (
    mode === "create" &&
    openingBalance !== "" &&
    Number.isFinite(openingValue) &&
    currency !== "PKR"
  ) {
    try {
      openingPkrPreview = toBase(openingValue, currency, rates);
    } catch {
      openingPkrPreview = null;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      if (mode === "create") {
        const response = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name,
            type,
            currency,
            openingBalance: openingBalance === "" ? 0 : Number(openingBalance),
          }),
        });

        const data = (await response.json()) as {
          error?: string;
          fields?: Record<string, string>;
        };

        if (!response.ok) {
          if (data.fields) {
            setFieldErrors(data.fields);
          }
          setError(data.error ?? "Unable to create account.");
          return;
        }

        router.push("/accounts?created=1");
        router.refresh();
        return;
      }

      if (!accountId) {
        setError("Missing account id.");
        return;
      }

      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          type,
          ...(currencyLocked ? {} : { currency }),
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        fields?: Record<string, string>;
        code?: string;
      };

      if (!response.ok) {
        if (data.fields) {
          setFieldErrors(data.fields);
        }
        setError(data.error ?? "Unable to update account.");
        return;
      }

      router.push("/accounts?updated=1");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
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
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-[#1a1d29]">
          Account name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={Boolean(fieldErrors.name)}
          className="w-full rounded-lg border border-[#e4e7ee] px-3 py-2.5 text-base text-[#1a1d29] outline-none focus:border-[#2f5fdc] focus:ring-2 focus:ring-[#2f5fdc]/20"
        />
        {fieldErrors.name ? (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="type" className="mb-1 block text-sm font-medium text-[#1a1d29]">
          Type
        </label>
        <select
          id="type"
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value as AccountType)}
          className="w-full rounded-lg border border-[#e4e7ee] px-3 py-2.5 text-base text-[#1a1d29] outline-none focus:border-[#2f5fdc] focus:ring-2 focus:ring-[#2f5fdc]/20"
        >
          {ACCOUNT_TYPES.map((accountType) => (
            <option key={accountType} value={accountType}>
              {ACCOUNT_TYPE_LABELS[accountType]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="currency" className="mb-1 block text-sm font-medium text-[#1a1d29]">
          Currency
        </label>
        <select
          id="currency"
          name="currency"
          value={currency}
          onChange={(event) =>
            setCurrency(event.target.value as AccountCurrency)
          }
          disabled={currencyLocked}
          className="w-full rounded-lg border border-[#e4e7ee] px-3 py-2.5 text-base text-[#1a1d29] outline-none focus:border-[#2f5fdc] focus:ring-2 focus:ring-[#2f5fdc]/20 disabled:bg-[#f4f6fb] disabled:text-[#5a6072]"
        >
          {ACCOUNT_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-[#5a6072]">
          Ledger always stores PKR. USD opening balances and later amounts are
          converted once at the current spot rate. Group expenses still require
          a PKR account.
        </p>
        {currencyLocked ? (
          <p className="mt-1 text-sm text-[#5a6072]">
            Currency cannot be changed after transactions exist on this account.
          </p>
        ) : null}
        {fieldErrors.currency ? (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.currency}</p>
        ) : null}
      </div>

      {mode === "create" ? (
        <div>
          <label
            htmlFor="openingBalance"
            className="mb-1 block text-sm font-medium text-[#1a1d29]"
          >
            Opening balance ({currency})
          </label>
          <input
            id="openingBalance"
            name="openingBalance"
            type="number"
            step="0.01"
            value={openingBalance}
            onChange={(event) => setOpeningBalance(event.target.value)}
            className="w-full rounded-lg border border-[#e4e7ee] px-3 py-2.5 text-base text-[#1a1d29] outline-none focus:border-[#2f5fdc] focus:ring-2 focus:ring-[#2f5fdc]/20"
          />
          {openingPkrPreview !== null ? (
            <p className="mt-1 text-sm text-[#5a6072]">
              ≈ {format(openingPkrPreview)} on the ledger
            </p>
          ) : null}
          {fieldErrors.openingBalance ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.openingBalance}</p>
          ) : null}
          {showNegativeWarning ? (
            <p className="mt-1 text-sm text-amber-700">
              Negative opening balance is allowed. Your account may start below zero.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1e3fae] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? "Create account"
              : "Save changes"}
        </button>
        <Link
          href="/accounts"
          className="rounded-lg border border-[#e4e7ee] px-4 py-2.5 text-center text-sm font-medium text-[#1a1d29] transition-colors hover:bg-[#f4f6fb]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
