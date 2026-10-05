import { NextResponse } from "next/server";

import {
  GroupAccessError,
  groupAccessErrorResponse,
} from "@/lib/group-access";
import {
  AccountNotFoundError,
  AccountOwnershipError,
  InvalidLedgerAmountError,
  TransactionsUnavailableError,
} from "@/lib/ledger-errors";

export class TransferStateError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "TransferStateError";
    this.status = status;
    this.code = code;
  }
}

export function transferErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof GroupAccessError) {
    return NextResponse.json(groupAccessErrorResponse(error), {
      status: error.status,
    });
  }

  if (error instanceof TransferStateError) {
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
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (error instanceof InvalidLedgerAmountError) {
    return NextResponse.json(
      { error: error.message, fields: { amount: error.message } },
      { status: 400 },
    );
  }

  return null;
}
