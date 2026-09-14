import type { AccountType } from "@/lib/account-types";
import {
  formatPkrAmount,
  type FxRateTable,
} from "@/lib/fx";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: "Bank",
  cash: "Cash",
  wallet: "Wallet",
};

export type FormatMoneyOptions = {
  /** User preferred display currency. Amount is always PKR. */
  currency?: string;
  rates?: FxRateTable;
};

/**
 * Format a **PKR ledger amount** for display.
 * Pass `{ currency, rates }` to convert once at the edge.
 * A bare currency string without rates only formats as that code when it is PKR;
 * foreign codes without rates fall back to PKR (no silent wrong FX).
 */
export function formatMoney(
  amountPkr: number,
  currencyOrOptions: string | FormatMoneyOptions = "PKR",
): string {
  if (typeof currencyOrOptions === "string") {
    return formatPkrAmount(amountPkr, {
      displayCurrency: currencyOrOptions,
      rates: {},
    });
  }

  return formatPkrAmount(amountPkr, {
    displayCurrency: currencyOrOptions.currency,
    rates: currencyOrOptions.rates,
  });
}

export function formatDateTime(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}
