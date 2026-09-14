import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { Account, type IAccount } from "@/models/Account";
import { Transaction } from "@/models/Transaction";

export async function findOwnedAccount(
  userId: string,
  accountId: string,
): Promise<IAccount | null> {
  if (!mongoose.isValidObjectId(accountId)) {
    return null;
  }

  await connectDB();
  return Account.findOne({
    _id: accountId,
    owner: userId,
  });
}

export async function accountHasTransactions(
  accountId: mongoose.Types.ObjectId | string,
): Promise<boolean> {
  const count = await Transaction.countDocuments({ account: accountId });
  return count > 0;
}

export async function accountHasNonOpeningTransactions(
  accountId: mongoose.Types.ObjectId | string,
): Promise<boolean> {
  const count = await Transaction.countDocuments({
    account: accountId,
    sourceType: { $ne: "opening_balance" },
  });
  return count > 0;
}

export type AccountDeletePolicy =
  | { canDelete: true; reverseOpeningBalance: boolean }
  | { canDelete: false; reason: "has_history" };

export async function getAccountDeletePolicy(
  accountId: mongoose.Types.ObjectId | string,
): Promise<AccountDeletePolicy> {
  const hasNonOpening = await accountHasNonOpeningTransactions(accountId);
  if (hasNonOpening) {
    return { canDelete: false, reason: "has_history" };
  }

  const hasOpening = await Transaction.exists({
    account: accountId,
    sourceType: "opening_balance",
  });

  return {
    canDelete: true,
    reverseOpeningBalance: Boolean(hasOpening),
  };
}
