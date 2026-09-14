"use client";

import Link from "next/link";

import { useMoney } from "@/components/currency/CurrencyProvider";

export function FxStatusBanner() {
  const { preferredCurrency, rateMissing, rateUsed, asOf } = useMoney();

  if (preferredCurrency === "PKR") {
    return null;
  }

  if (rateMissing) {
    return (
      <div
        role="status"
        className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950 sm:px-6"
      >
        Display currency {preferredCurrency} has no FX rate — showing PKR.{" "}
        <Link href="/settings" className="font-semibold underline">
          Settings
        </Link>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="border-b border-[#e4e7ee] bg-[#f4f7fd] px-4 py-2 text-center text-xs text-[#5a6072] sm:px-6"
    >
      Stored as PKR; shown in {preferredCurrency}
      {rateUsed ? ` @ ${rateUsed}` : ""}. Rates as of{" "}
      {new Date(asOf).toLocaleString()} ·{" "}
      <Link href="/settings" className="font-medium text-[#2f5fdc] hover:underline">
        Change
      </Link>
    </div>
  );
}
