import mongoose from "mongoose";

import { sumBalance } from "@/lib/ledger";
import { roundAmount } from "@/lib/money";
import { Account } from "@/models/Account";
import { Expense } from "@/models/Expense";
import { GroupExpense } from "@/models/GroupExpense";
import { GroupTransfer } from "@/models/GroupTransfer";
import { Income } from "@/models/Income";
import {
  Transaction,
  type TransactionSourceType,
} from "@/models/Transaction";

export interface BalanceDriftRow {
  accountId: string;
  name: string;
  cachedBalance: number;
  ledgerSum: number;
  delta: number;
}

export interface OrphanTransactionRow {
  transactionId: string;
  accountId: string;
  sourceType: TransactionSourceType;
  sourceId: string;
  reason: string;
}

export interface LedgerAuditReport {
  accountCount: number;
  transactionCount: number;
  drifts: BalanceDriftRow[];
  orphans: OrphanTransactionRow[];
  ok: boolean;
}

async function sourceExists(
  sourceType: TransactionSourceType,
  sourceId: mongoose.Types.ObjectId,
): Promise<boolean> {
  switch (sourceType) {
    case "opening_balance":
    case "adjustment":
      return Boolean(await Account.exists({ _id: sourceId }));
    case "expense":
      return Boolean(await Expense.exists({ _id: sourceId }));
    case "income":
      return Boolean(await Income.exists({ _id: sourceId }));
    case "group_expense":
      return Boolean(await GroupExpense.exists({ _id: sourceId }));
    case "group_transfer":
      return Boolean(await GroupTransfer.exists({ _id: sourceId }));
    default: {
      const _exhaustive: never = sourceType;
      void _exhaustive;
      return false;
    }
  }
}

export async function findBalanceDrifts(): Promise<BalanceDriftRow[]> {
  const accounts = await Account.find({}).select("name cachedBalance").lean();
  const drifts: BalanceDriftRow[] = [];

  for (const account of accounts) {
    const accountId = account._id.toString();
    const ledgerSum = await sumBalance(account._id);
    if (account.cachedBalance !== ledgerSum) {
      drifts.push({
        accountId,
        name: account.name,
        cachedBalance: account.cachedBalance,
        ledgerSum,
        delta: roundAmount(account.cachedBalance - ledgerSum),
      });
    }
  }

  return drifts;
}

/** Throws if any account's cachedBalance differs from the ledger sum. */
export async function assertNoBalanceDrift(): Promise<void> {
  const drifts = await findBalanceDrifts();
  if (drifts.length === 0) {
    return;
  }

  const summary = drifts
    .map(
      (row) =>
        `${row.accountId} (${row.name}): cached=${row.cachedBalance} ledger=${row.ledgerSum}`,
    )
    .join("; ");
  throw new Error(`Balance drift detected: ${summary}`);
}

/**
 * Finds transactions whose sourceId no longer exists in the collection
 * implied by sourceType. `opening_balance` / `adjustment` require the Account.
 */
export async function findOrphanTransactions(): Promise<OrphanTransactionRow[]> {
  const transactions = await Transaction.find({})
    .select("account sourceType sourceId")
    .lean();
  const orphans: OrphanTransactionRow[] = [];

  for (const tx of transactions) {
    const accountExists = await Account.exists({ _id: tx.account });
    if (!accountExists) {
      orphans.push({
        transactionId: tx._id.toString(),
        accountId: tx.account.toString(),
        sourceType: tx.sourceType,
        sourceId: tx.sourceId.toString(),
        reason: "Account missing for transaction",
      });
      continue;
    }

    const exists = await sourceExists(tx.sourceType, tx.sourceId);
    if (!exists) {
      orphans.push({
        transactionId: tx._id.toString(),
        accountId: tx.account.toString(),
        sourceType: tx.sourceType,
        sourceId: tx.sourceId.toString(),
        reason: `Missing ${tx.sourceType} source`,
      });
    }
  }

  return orphans;
}

export async function assertNoOrphanTransactions(): Promise<void> {
  const orphans = await findOrphanTransactions();
  if (orphans.length === 0) {
    return;
  }

  const summary = orphans
    .map(
      (row) =>
        `${row.transactionId} ${row.sourceType}/${row.sourceId}: ${row.reason}`,
    )
    .join("; ");
  throw new Error(`Orphan transactions detected: ${summary}`);
}

export async function runLedgerAudit(): Promise<LedgerAuditReport> {
  const [accountCount, transactionCount, drifts, orphans] = await Promise.all([
    Account.countDocuments(),
    Transaction.countDocuments(),
    findBalanceDrifts(),
    findOrphanTransactions(),
  ]);

  return {
    accountCount,
    transactionCount,
    drifts,
    orphans,
    ok: drifts.length === 0 && orphans.length === 0,
  };
}
