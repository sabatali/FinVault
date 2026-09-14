"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { formatPkrAmount } from "@/lib/fx";
import type { DisplayCurrency, FxRateTable } from "@/lib/fx";

export interface CurrencyContextValue {
  preferredCurrency: DisplayCurrency;
  rates: FxRateTable;
  asOf: string;
  /** True when preferred is foreign but rate is missing. */
  rateMissing: boolean;
  format: (amountPkr: number) => string;
  rateUsed: number | null;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  preferredCurrency,
  rates,
  asOf,
  children,
}: {
  preferredCurrency: DisplayCurrency;
  rates: FxRateTable;
  asOf: string;
  children: ReactNode;
}) {
  const rateMissing =
    preferredCurrency !== "PKR" &&
    !(typeof rates[preferredCurrency] === "number" && rates[preferredCurrency]! > 0);

  const rateUsed =
    preferredCurrency === "PKR"
      ? 1
      : rateMissing
        ? null
        : (rates[preferredCurrency] ?? null);

  const format = useCallback(
    (amountPkr: number) =>
      formatPkrAmount(amountPkr, {
        displayCurrency: preferredCurrency,
        rates,
      }),
    [preferredCurrency, rates],
  );

  const value = useMemo(
    () => ({
      preferredCurrency,
      rates,
      asOf,
      rateMissing,
      format,
      rateUsed,
    }),
    [preferredCurrency, rates, asOf, rateMissing, format, rateUsed],
  );

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useMoney(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    return {
      preferredCurrency: "PKR",
      rates: {},
      asOf: new Date(0).toISOString(),
      rateMissing: false,
      format: (amountPkr: number) =>
        formatPkrAmount(amountPkr, { displayCurrency: "PKR", rates: {} }),
      rateUsed: 1,
    };
  }
  return ctx;
}
