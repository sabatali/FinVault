import { NextResponse } from "next/server";

import {
  GroupAccessError,
  groupAccessErrorResponse,
} from "@/lib/group-access";
import { GroupExpenseLedgerError } from "@/lib/group-expense-ledger";
import { GroupExpenseMutationError } from "@/lib/group-expense-service";
import {
  AccountNotFoundError,
  AccountOwnershipError,
  InvalidLedgerAmountError,
  TransactionsUnavailableError,
} from "@/lib/ledger-errors";

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}

export function groupExpenseErrorResponse(
  error: unknown,
): NextResponse | null {
  if (error instanceof GroupAccessError) {
    return NextResponse.json(groupAccessErrorResponse(error), {
      status: error.status,
    });
  }

  if (error instanceof GroupExpenseMutationError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
        ...(error.fields ? { fields: error.fields } : {}),
        ...(error.expected !== undefined ? { expected: error.expected } : {}),
        ...(error.actual !== undefined ? { actual: error.actual } : {}),
      },
      { status: error.status },
    );
  }

  if (error instanceof GroupExpenseLedgerError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  if (error instanceof TransactionsUnavailableError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  if (
    error instanceof AccountNotFoundError ||
    error instanceof AccountOwnershipError
  ) {
    return NextResponse.json(
      {
        error:
          error instanceof AccountOwnershipError
            ? "Payer account does not belong to the payer."
            : "Account not found",
        code:
          error instanceof AccountOwnershipError
            ? "ACCOUNT_OWNER_MISMATCH"
            : "ACCOUNT_NOT_FOUND",
      },
      { status: error instanceof AccountOwnershipError ? 400 : 404 },
    );
  }

  if (error instanceof InvalidLedgerAmountError) {
    return NextResponse.json(
      { error: error.message, fields: { amount: error.message } },
      { status: 400 },
    );
  }

  if (isDuplicateKeyError(error)) {
    return NextResponse.json(
      { error: "This group expense was already recorded." },
      { status: 409 },
    );
  }

  return null;
}
