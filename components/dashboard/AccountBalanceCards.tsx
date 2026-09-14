"use client";

import Link from "next/link";

import { useMoney } from "@/components/currency/CurrencyProvider";
import { ACCOUNT_TYPE_LABELS } from "@/lib/format";
import type { DashboardAccountRow } from "@/lib/dashboard-personal";

interface AccountBalanceCardsProps {
  accounts: DashboardAccountRow[];
  currency?: string;
}

export function AccountBalanceCards({ accounts }: AccountBalanceCardsProps) {
  const { format } = useMoney();

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => {
        const isNegative = account.cachedBalance < 0;
        return (
          <li key={account.id}>
            <Link
              href={`/accounts/${account.id}`}
              className="block rounded-xl border border-[#e4e7ee] bg-white p-4 transition-colors hover:border-[#2f5fdc]/40 hover:bg-[#f8f9fd]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#1a1d29]">{account.name}</p>
                  <p className="mt-1 text-xs text-[#5a6072]">
                    {ACCOUNT_TYPE_LABELS[account.type]}
                  </p>
                </div>
                <p
                  className={`text-lg font-bold ${
                    isNegative ? "text-red-600" : "text-[#1a1d29]"
                  }`}
                  aria-label={
                    isNegative
                      ? `Negative balance ${format(account.cachedBalance)}`
                      : `Balance ${format(account.cachedBalance)}`
                  }
                >
                  {format(account.cachedBalance)}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
