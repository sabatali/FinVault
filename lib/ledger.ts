import mongoose, { type ClientSession } from "mongoose";

import {
  AccountNotFoundError,
  AccountOwnershipError,
  BalanceMismatchError,
  InvalidLedgerAmountError,
} from "@/lib/ledger-errors";
import { assertFiniteAmount, roundAmount } from "@/lib/money";
import { withOptionalTransaction } from "@/lib/with-transaction";
import { Account } from "@/models/Account";
import {
  Transaction,
  type ITransaction,
  type TransactionEntryType,
  type TransactionSourceType,
} from "@/models/Transaction";

export interface PostLedgerEntryInput {
  accountId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  entryType: TransactionEntryType;
  amount: number;
  sourceType: TransactionSourceType;
  sourceId: mongoose.Types.ObjectId | string;
  description?: string;
  occurredAt?: Date;
  currency?: string;
  session?: ClientSession | null;
}

function sessionOptions(session: ClientSession | null | undefined) {
  return session ? { session } : undefined;
}

function applyBalanceDelta(
  currentBalance: number,
  entryType: TransactionEntryType,
  amount: number,
): number {
  if (entryType === "credit") {
    return roundAmount(currentBalance + amount);
  }
  return roundAmount(currentBalance - amount);
}

function reverseBalanceDelta(
  currentBalance: number,
  entryType: TransactionEntryType,
  amount: number,
): number {
  if (entryType === "credit") {
    return roundAmount(currentBalance - amount);
  }
  return roundAmount(currentBalance + amount);
}

async function postLedgerEntryInternal(
  input: PostLedgerEntryInput,
  session: ClientSession | null,
): Promise<ITransaction> {
  const amount = assertFiniteAmount(input.amount, "amount");
  if (amount <= 0) {
    throw new InvalidLedgerAmountError("Amount must be greater than zero");
  }

  const accountObjectId = new mongoose.Types.ObjectId(input.accountId);
  const userObjectId = new mongoose.Types.ObjectId(input.userId);
  const sourceObjectId = new mongoose.Types.ObjectId(input.sourceId);

  const accountQuery = Account.findById(accountObjectId);
  if (session) {
    accountQuery.session(session);
  }
  const account = await accountQuery;

  if (!account) {
    throw new AccountNotFoundError(accountObjectId.toString());
  }

  if (!account.owner.equals(userObjectId)) {
    throw new AccountOwnershipError();
  }

  const [transaction] = await Transaction.create(
    [
      {
        account: accountObjectId,
        user: userObjectId,
        entryType: input.entryType,
        amount,
        currency: input.currency ?? account.currency ?? "PKR",
        sourceType: input.sourceType,
        sourceId: sourceObjectId,
        description: input.description?.trim().slice(0, 200) ?? "",
        occurredAt: input.occurredAt ?? new Date(),
      },
    ],
    sessionOptions(session),
  );

  account.cachedBalance = applyBalanceDelta(
    account.cachedBalance,
    input.entryType,
    amount,
  );
  await account.save(sessionOptions(session));

  return transaction;
}

export async function postLedgerEntry(
  input: PostLedgerEntryInput,
): Promise<ITransaction> {
  if (input.session !== undefined) {
    return postLedgerEntryInternal(input, input.session);
  }

  return withOptionalTransaction((session) =>
    postLedgerEntryInternal(input, session),
  );
}

export async function sumBalance(
  accountId: mongoose.Types.ObjectId | string,
  session?: ClientSession | null,
): Promise<number> {
  const accountObjectId = new mongoose.Types.ObjectId(accountId);

  const pipeline = Transaction.aggregate([
    { $match: { account: accountObjectId } },
    {
      $group: {
        _id: null,
        credits: {
          $sum: {
            $cond: [{ $eq: ["$entryType", "credit"] }, "$amount", 0],
          },
        },
        debits: {
          $sum: {
            $cond: [{ $eq: ["$entryType", "debit"] }, "$amount", 0],
          },
        },
      },
    },
  ]);

  if (session) {
    pipeline.session(session);
  }

  const result = await pipeline;

  if (!result.length) {
    return 0;
  }

  const { credits, debits } = result[0] as { credits: number; debits: number };
  return roundAmount(credits - debits);
}

export async function assertAccountBalanceMatchesLedger(
  accountId: mongoose.Types.ObjectId | string,
  session?: ClientSession | null,
): Promise<void> {
  const accountObjectId = new mongoose.Types.ObjectId(accountId);
  const accountQuery = Account.findById(accountObjectId);
  if (session) {
    accountQuery.session(session);
  }
  const account = await accountQuery;

  if (!account) {
    throw new AccountNotFoundError(accountObjectId.toString());
  }

  const ledgerSum = await sumBalance(accountObjectId, session);

  if (account.cachedBalance !== ledgerSum) {
    throw new BalanceMismatchError(
      accountObjectId.toString(),
      account.cachedBalance,
      ledgerSum,
    );
  }
}

async function reverseLedgerEntriesForSourceInternal(
  input: {
    sourceType: TransactionSourceType;
    sourceId: mongoose.Types.ObjectId | string;
  },
  session: ClientSession | null,
): Promise<number> {
  const sourceObjectId = new mongoose.Types.ObjectId(input.sourceId);

  const txQuery = Transaction.find({
    sourceType: input.sourceType,
    sourceId: sourceObjectId,
  });
  if (session) {
    txQuery.session(session);
  }
  const transactions = await txQuery;

  for (const transaction of transactions) {
    const accountQuery = Account.findById(transaction.account);
    if (session) {
      accountQuery.session(session);
    }
    const account = await accountQuery;

    if (!account) {
      throw new AccountNotFoundError(transaction.account.toString());
    }

    account.cachedBalance = reverseBalanceDelta(
      account.cachedBalance,
      transaction.entryType,
      transaction.amount,
    );
    await account.save(sessionOptions(session));
    await transaction.deleteOne(sessionOptions(session));
  }

  return transactions.length;
}

export async function reverseLedgerEntriesForSource(input: {
  sourceType: TransactionSourceType;
  sourceId: mongoose.Types.ObjectId | string;
  session?: ClientSession | null;
}): Promise<number> {
  if (input.session !== undefined) {
    return reverseLedgerEntriesForSourceInternal(input, input.session);
  }

  return withOptionalTransaction((session) =>
    reverseLedgerEntriesForSourceInternal(input, session),
  );
}

/** @deprecated Use reverseLedgerEntriesForSource */
export const reverseLedgerEntry = reverseLedgerEntriesForSource;
