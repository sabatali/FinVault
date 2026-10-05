"use client";

import Link from "next/link";

import { useMoney } from "@/components/currency/CurrencyProvider";
import { ACCOUNT_TYPE_LABELS } from "@/lib/format";
import type { AccountType } from "@/lib/account-types";

interface AccountHeaderProps {
  name: string;
  type: AccountType;
  currency: string;
  balance: number;
  showMismatchWarning?: boolean;
  owedToYou?: number;
}

export function AccountHeader({
  name,
  type,
  balance,
  showMismatchWarning = false,
  owedToYou = 0,
}: AccountHeaderProps) {
  const { format } = useMoney();
  const isNegative = balance < 0;
  const balanceLabel = isNegative
    ? `Negative balance: ${format(balance)}`
    : `Balance: ${format(balance)}`;

  return (
    <header className="rounded-xl border border-[#e4e7ee] bg-white p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1d29]">
            {name}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#5a6072]">
            <span className="rounded-full bg-[#eef1f8] px-2.5 py-1 text-xs font-medium text-[#2f5fdc]">
              {ACCOUNT_TYPE_LABELS[type]}
            </span>
            <span>Ledger PKR</span>
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5a6072]">
            Current balance
          </p>
          <p
            className={`mt-1 text-3xl font-bold ${
              isNegative ? "text-red-600" : "text-[#1a1d29]"
            }`}
            aria-label={balanceLabel}
          >
            {format(balance)}
            {isNegative ? (
              <span className="sr-only"> (negative balance)</span>
            ) : null}
          </p>
        </div>
      </div>

      {owedToYou > 0 ? (
        <p className="mt-4 text-sm text-[#5a6072]">
          {format(owedToYou)} owed to you across groups — not included in this
          balance.{" "}
          <Link href="/groups" className="font-semibold text-[#2f5fdc] hover:underline">
            View groups
          </Link>
        </p>
      ) : null}

      {showMismatchWarning ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Development note: cached balance differs from the ledger. Displaying
          ledger sum as the source of truth.
        </p>
      ) : null}
    </header>
  );
}
