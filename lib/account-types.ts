/** Client-safe account constants and DTO types (no Mongoose). */

export const ACCOUNT_TYPES = ["bank", "cash", "wallet"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Account input / denomination currencies (ledger amounts stay PKR). */
export const ACCOUNT_CURRENCIES = ["PKR", "USD"] as const;
export type AccountCurrency = (typeof ACCOUNT_CURRENCIES)[number];

export function isAccountCurrency(value: string): value is AccountCurrency {
  return (ACCOUNT_CURRENCIES as readonly string[]).includes(value);
}

export interface AccountPublic {
  id: string;
  owner: string;
  name: string;
  type: AccountType;
  currency: string;
  cachedBalance: number;
  openingBalance: number;
  createdAt: string;
  updatedAt: string;
}
