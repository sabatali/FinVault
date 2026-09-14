import type { ClientSession } from "mongoose";
import mongoose from "mongoose";

import { postLedgerEntry } from "@/lib/ledger";
import type { IGroup } from "@/models/Group";
import type { IGroupMember } from "@/models/GroupMember";
import type { IGroupTransfer } from "@/models/GroupTransfer";
import { Transaction } from "@/models/Transaction";

export function transferInvolvesGuest(
  fromMember: IGroupMember,
  toMember: IGroupMember,
): boolean {
  return (
    fromMember.memberType === "guest" || toMember.memberType === "guest"
  );
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}

async function findExistingTransferTx(input: {
  sourceId: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  session?: ClientSession | null;
}) {
  const query = Transaction.findOne({
    sourceType: "group_transfer",
    sourceId: input.sourceId,
    account: input.accountId,
  });
  if (input.session) {
    query.session(input.session);
  }
  return query;
}

/**
 * Posts ledger rows for confirmed / auto_confirmed transfers.
 * Guest sides have no Account — those legs are skipped (no-op).
 * Idempotent: reuses existing (sourceType, sourceId, account) rows.
 */
export async function applyGroupTransferLedger(input: {
  transfer: IGroupTransfer;
  group: IGroup;
  fromMember: IGroupMember;
  toMember: IGroupMember;
  session?: ClientSession | null;
}): Promise<{
  debitTransactionId: string | null;
  creditTransactionId: string | null;
}> {
  const { transfer, group, fromMember, toMember, session } = input;
  const opts = session ? { session } : undefined;

  if (
    transfer.status !== "confirmed" &&
    transfer.status !== "auto_confirmed"
  ) {
    throw new Error("Ledger apply only runs for confirmed transfers");
  }

  const existingQuery = Transaction.find({
    sourceType: "group_transfer",
    sourceId: transfer._id,
  });
  if (session) {
    existingQuery.session(session);
  }
  const existingRows = await existingQuery;
  const byAccount = new Map<string, { _id: mongoose.Types.ObjectId }>(
    existingRows.map((row) => [row.account.toString(), { _id: row._id }]),
  );

  const description = `${group.name} · Settlement`;
  let debitTransactionId: mongoose.Types.ObjectId | null =
    transfer.debitTransactionId;
  let creditTransactionId: mongoose.Types.ObjectId | null =
    transfer.creditTransactionId;

  const senderNeedsDebit =
    fromMember.memberType === "registered" &&
    Boolean(fromMember.user) &&
    Boolean(transfer.fromAccount);

  const receiverNeedsCredit =
    toMember.memberType === "registered" &&
    Boolean(toMember.user) &&
    Boolean(transfer.toAccount);

  async function ensureLeg(input: {
    accountId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    entryType: "debit" | "credit";
  }): Promise<mongoose.Types.ObjectId> {
    const existing = byAccount.get(input.accountId.toString());
    if (existing) {
      return existing._id;
    }

    try {
      const posted = await postLedgerEntry({
        accountId: input.accountId,
        userId: input.userId,
        entryType: input.entryType,
        amount: transfer.amount,
        sourceType: "group_transfer",
        sourceId: transfer._id,
        description,
        currency: transfer.currency,
        session,
      });
      byAccount.set(input.accountId.toString(), { _id: posted._id });
      return posted._id;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const recovered = await findExistingTransferTx({
          sourceId: transfer._id,
          accountId: input.accountId,
          session,
        });
        if (recovered) {
          byAccount.set(input.accountId.toString(), { _id: recovered._id });
          return recovered._id;
        }
      }
      throw error;
    }
  }

  if (senderNeedsDebit) {
    debitTransactionId = await ensureLeg({
      accountId: transfer.fromAccount!,
      userId: fromMember.user!,
      entryType: "debit",
    });
  }

  if (receiverNeedsCredit) {
    creditTransactionId = await ensureLeg({
      accountId: transfer.toAccount!,
      userId: toMember.user!,
      entryType: "credit",
    });
  }

  transfer.debitTransactionId = debitTransactionId;
  transfer.creditTransactionId = creditTransactionId;
  await transfer.save(opts);

  return {
    debitTransactionId: debitTransactionId?.toString() ?? null,
    creditTransactionId: creditTransactionId?.toString() ?? null,
  };
}
