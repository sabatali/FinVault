export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerError";
  }
}

export class AccountNotFoundError extends LedgerError {
  constructor(accountId: string) {
    super(`Account not found: ${accountId}`);
    this.name = "AccountNotFoundError";
  }
}

export class AccountOwnershipError extends LedgerError {
  constructor() {
    super("Account does not belong to the specified user");
    this.name = "AccountOwnershipError";
  }
}

export class InvalidLedgerAmountError extends LedgerError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLedgerAmountError";
  }
}

export class BalanceMismatchError extends LedgerError {
  constructor(accountId: string, cached: number, ledgerSum: number) {
    super(
      `Balance mismatch for account ${accountId}: cached=${cached}, ledger=${ledgerSum}`,
    );
    this.name = "BalanceMismatchError";
  }
}
