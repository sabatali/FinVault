import type { ClientSession } from "mongoose";

import {
  AccountNotFoundError,
  AccountOwnershipError,
} from "@/lib/ledger-errors";
import { postLedgerEntry } from "@/lib/ledger";
import { Account } from "@/models/Account";
import type { IGroup } from "@/models/Group";
import type { IGroupExpense } from "@/models/GroupExpense";
import type { IGroupMember } from "@/models/GroupMember";
import type { ITransaction } from "@/models/Transaction";

export class GroupExpenseLedgerError extends Error {
  code: string;
  status: number;

  constructor(message: string, status = 400, code = "LEDGER_ERROR") {
    super(message);
    this.name = "GroupExpenseLedgerError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Posts the single full-amount debit for a registered payer's group expense.
 * Guest payers must not call this (no Transaction).
 * Account.cachedBalance updates only via postLedgerEntry.
 */
export async function postGroupExpenseDebit(input: {
  expense: IGroupExpense;
  group: IGroup;
  payerMember: IGroupMember;
  session?: ClientSession | null;
}): Promise<ITransaction> {
  const { expense, group, payerMember, session } = input;

  if (payerMember.memberType !== "registered" || !payerMember.user) {
    throw new GroupExpenseLedgerError(
      "Guest payers do not create ledger debits",
      400,
      "GUEST_NO_DEBIT",
    );
  }

  if (!expense.payerAccount) {
    throw new GroupExpenseLedgerError(
      "Registered payer requires a linked payer account",
      400,
      "NO_PAYER_ACCOUNT",
    );
  }

  const accountQuery = Account.findById(expense.payerAccount);
  if (session) {
    accountQuery.session(session);
  }
  const account = await accountQuery;

  if (!account) {
    throw new AccountNotFoundError(expense.payerAccount.toString());
  }

  if (!account.owner.equals(payerMember.user)) {
    throw new AccountOwnershipError();
  }

  const transaction = await postLedgerEntry({
    accountId: expense.payerAccount,
    userId: payerMember.user,
    entryType: "debit",
    amount: expense.amount,
    sourceType: "group_expense",
    sourceId: expense._id,
    description: `${group.name} · ${expense.description}`,
    occurredAt: expense.occurredAt,
    currency: expense.currency,
    session,
  });

  if (transaction.amount !== expense.amount) {
    throw new GroupExpenseLedgerError(
      "Ledger debit amount must equal the expense total",
      500,
      "DEBIT_AMOUNT_MISMATCH",
    );
  }

  return transaction;
}
