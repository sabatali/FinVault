"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";

interface NetWorthHeroProps {
  netWorth: number;
  accountsSum: number;
  accountCount: number;
  currency?: string;
}

export function NetWorthHero({
  netWorth,
  accountsSum,
  accountCount,
}: NetWorthHeroProps) {
  const { format } = useMoney();
  const isNegative = netWorth < 0;
  const mismatch = Math.abs(netWorth - accountsSum) >= 0.005;

  return (
    <section className="rounded-xl border border-[#e4e7ee] bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#5a6072]">
        Net worth
      </p>
      <p
        className={`mt-2 text-4xl font-extrabold tracking-tight ${
          isNegative ? "text-red-600" : "text-[#1a1d29]"
        }`}
        aria-label={
          isNegative
            ? `Negative net worth ${format(netWorth)}`
            : `Net worth ${format(netWorth)}`
        }
      >
        {format(netWorth)}
        {isNegative ? (
          <span className="sr-only"> (negative net worth)</span>
        ) : null}
      </p>
      <p className="mt-2 text-sm text-[#5a6072]">
        Sum of {accountCount} account{accountCount === 1 ? "" : "s"} (ledger
        balances in PKR). Group IOUs are shown separately and are not included
        here.
      </p>
      {mismatch ? (
        <p role="status" className="mt-2 text-sm text-amber-800">
          Warning: net worth ({format(netWorth)}) does not match accounts sum (
          {format(accountsSum)}).
        </p>
      ) : null}
    </section>
  );
}

export function NetWorthHeroSkeleton() {
  return (
    <div className="h-36 animate-pulse rounded-xl border border-[#e4e7ee] bg-[#eef1f8]" />
  );
}
