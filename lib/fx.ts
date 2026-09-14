import { roundAmount } from "@/lib/money";

export const FX_BASE = "PKR" as const;

export const DISPLAY_CURRENCIES = ["PKR", "USD", "EUR"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/**
 * Rates as PKR per 1 unit of foreign currency.
 * e.g. USD: 278.5 means 1 USD = 278.50 PKR.
 */
export type FxRateTable = Partial<Record<Exclude<DisplayCurrency, "PKR">, number>>;

export interface FxSnapshot {
  base: typeof FX_BASE;
  rates: FxRateTable;
  asOf: string;
}

function envRate(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

/** Static spot rates for local/dev (override via env). */
export function getFxSnapshot(now = new Date()): FxSnapshot {
  return {
    base: FX_BASE,
    rates: {
      USD: envRate("FX_USD_PKR", 278.5),
      EUR: envRate("FX_EUR_PKR", 300),
    },
    asOf: now.toISOString(),
  };
}

export function isDisplayCurrency(value: string): value is DisplayCurrency {
  return (DISPLAY_CURRENCIES as readonly string[]).includes(value);
}

export function normalizeDisplayCurrency(value: string | null | undefined): DisplayCurrency {
  if (!value) {
    return FX_BASE;
  }
  const upper = value.trim().toUpperCase();
  if (isDisplayCurrency(upper)) {
    return upper;
  }
  return FX_BASE;
}

/**
 * Convert a PKR ledger amount to the display currency (once).
 * Unknown / missing rate → returns PKR amount unchanged (caller should warn).
 */
export function toDisplay(
  amountPkr: number,
  target: string,
  rates: FxRateTable,
): { amount: number; currency: DisplayCurrency; converted: boolean } {
  const display = normalizeDisplayCurrency(target);
  if (display === FX_BASE) {
    return { amount: roundAmount(amountPkr), currency: FX_BASE, converted: false };
  }

  const rate = rates[display];
  if (rate == null || !(rate > 0)) {
    return { amount: roundAmount(amountPkr), currency: FX_BASE, converted: false };
  }

  return {
    amount: roundAmount(amountPkr / rate),
    currency: display,
    converted: true,
  };
}

/**
 * Convert a display-currency input to PKR for storage.
 * Amounts entered on USD accounts are converted once here.
 */
export function toBase(
  amountDisplay: number,
  from: string,
  rates: FxRateTable,
): number {
  const source = normalizeDisplayCurrency(from);
  if (source === FX_BASE) {
    return roundAmount(amountDisplay);
  }
  const rate = rates[source];
  if (rate == null || !(rate > 0)) {
    throw new Error(`Missing FX rate for ${source}`);
  }
  return roundAmount(amountDisplay * rate);
}

/** Convert an amount typed in an account's currency into ledger PKR. */
export function toLedgerPkr(
  amountInAccountCurrency: number,
  accountCurrency: string,
  rates: FxRateTable = getFxSnapshot().rates,
): number {
  return toBase(amountInAccountCurrency, accountCurrency, rates);
}

export function formatDisplayAmount(
  amount: number,
  currency: DisplayCurrency,
): string {
  try {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Format a PKR ledger amount for display. Converts at most once.
 */
export function formatPkrAmount(
  amountPkr: number,
  options?: {
    displayCurrency?: string;
    rates?: FxRateTable;
  },
): string {
  const displayCurrency = normalizeDisplayCurrency(options?.displayCurrency);
  const rates = options?.rates ?? {};
  const converted = toDisplay(amountPkr, displayCurrency, rates);
  return formatDisplayAmount(converted.amount, converted.currency);
}
