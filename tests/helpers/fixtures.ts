import mongoose from "mongoose";

import { postLedgerEntry } from "@/lib/ledger";
import { withTransaction } from "@/lib/with-transaction";
import { Account, type IAccount } from "@/models/Account";
import { Expense } from "@/models/Expense";
import { Group, type IGroup } from "@/models/Group";
import {
  GroupExpense,
  type IGroupExpense,
} from "@/models/GroupExpense";
import {
  GroupMember,
  type IGroupMember,
} from "@/models/GroupMember";
import { Income } from "@/models/Income";
import { GroupMemberAccount } from "@/models/GroupMemberAccount";
import { Notification } from "@/models/Notification";
import { User, type IUser } from "@/models/User";
import { equalShares } from "@/lib/splits";
import { postGroupExpenseDebit } from "@/lib/group-expense-ledger";

export async function createUser(input?: {
  name?: string;
  email?: string;
}): Promise<IUser> {
  const suffix = new mongoose.Types.ObjectId().toString().slice(-6);
  return User.create({
    name: input?.name ?? `User ${suffix}`,
    email: input?.email ?? `user-${suffix}@example.com`,
    passwordHash: "test-hash",
    preferredCurrency: "PKR",
  });
}

export async function createAccountWithOpening(input: {
  owner: IUser;
  name?: string;
  openingBalance?: number;
}): Promise<IAccount> {
  const opening = input.openingBalance ?? 10_000;
  const accountId = new mongoose.Types.ObjectId();

  await withTransaction(async (session) => {
    const opts = { session };
    await Account.create(
      [
        {
          _id: accountId,
          owner: input.owner._id,
          name: input.name ?? "Cash",
          type: "cash",
          currency: "PKR",
          openingBalance: opening,
          cachedBalance: 0,
        },
      ],
      opts,
    );

    if (opening !== 0) {
      await postLedgerEntry({
        accountId,
        userId: input.owner._id,
        entryType: opening > 0 ? "credit" : "debit",
        amount: Math.abs(opening),
        sourceType: "opening_balance",
        sourceId: accountId,
        description: "Opening balance",
        session,
      });
    }
  });

  const account = await Account.findById(accountId);
  if (!account) {
    throw new Error("Failed to create account");
  }
  return account;
}

export async function createPersonalExpense(input: {
  user: IUser;
  account: IAccount;
  amount: number;
  description?: string;
}): Promise<{ expenseId: string }> {
  const expenseId = new mongoose.Types.ObjectId();
  const amount = input.amount;

  await withTransaction(async (session) => {
    const opts = { session };
    const transaction = await postLedgerEntry({
      accountId: input.account._id,
      userId: input.user._id,
      entryType: "debit",
      amount,
      sourceType: "expense",
      sourceId: expenseId,
      description: input.description ?? "Expense",
      session,
    });

    await Expense.create(
      [
        {
          _id: expenseId,
          user: input.user._id,
          account: input.account._id,
          amount,
          currency: "PKR",
          description: input.description ?? "Expense",
          category: null,
          occurredAt: new Date(),
          transactionId: transaction._id,
        },
      ],
      opts,
    );
  });

  return { expenseId: expenseId.toString() };
}

export async function createPersonalIncome(input: {
  user: IUser;
  account: IAccount;
  amount: number;
  description?: string;
}): Promise<{ incomeId: string }> {
  const incomeId = new mongoose.Types.ObjectId();
  const amount = input.amount;

  await withTransaction(async (session) => {
    const opts = { session };
    const transaction = await postLedgerEntry({
      accountId: input.account._id,
      userId: input.user._id,
      entryType: "credit",
      amount,
      sourceType: "income",
      sourceId: incomeId,
      description: input.description ?? "Income",
      session,
    });

    await Income.create(
      [
        {
          _id: incomeId,
          user: input.user._id,
          account: input.account._id,
          amount,
          currency: "PKR",
          description: input.description ?? "Income",
          category: null,
          occurredAt: new Date(),
          transactionId: transaction._id,
        },
      ],
      opts,
    );
  });

  return { incomeId: incomeId.toString() };
}

export async function createGroupWithMembers(input: {
  admin: IUser;
  otherRegistered?: IUser;
  guestEmail?: string;
  guestName?: string;
}): Promise<{
  group: IGroup;
  adminMember: IGroupMember;
  otherMember: IGroupMember | null;
  guestMember: IGroupMember | null;
}> {
  const group = await Group.create({
    name: "Test Group",
    createdBy: input.admin._id,
  });

  const adminMember = await GroupMember.create({
    group: group._id,
    user: input.admin._id,
    memberType: "registered",
    displayName: input.admin.name,
    email: input.admin.email,
    role: "admin",
  });

  let otherMember: IGroupMember | null = null;
  if (input.otherRegistered) {
    otherMember = await GroupMember.create({
      group: group._id,
      user: input.otherRegistered._id,
      memberType: "registered",
      displayName: input.otherRegistered.name,
      email: input.otherRegistered.email,
      role: "member",
    });
  }

  let guestMember: IGroupMember | null = null;
  if (input.guestEmail) {
    guestMember = await GroupMember.create({
      group: group._id,
      user: null,
      memberType: "guest",
      displayName: input.guestName ?? "Guest",
      email: input.guestEmail.toLowerCase(),
      role: "member",
    });
  }

  return { group, adminMember, otherMember, guestMember };
}

export async function createEqualGroupExpense(input: {
  group: IGroup;
  payerMember: IGroupMember;
  payerAccount: IAccount | null;
  participantIds: string[];
  amount: number;
  description?: string;
  createdBy: IUser;
}): Promise<IGroupExpense> {
  const shares = equalShares(input.amount, input.participantIds);
  const expenseId = new mongoose.Types.ObjectId();

  const expense = await withTransaction(async (session) => {
    const opts = { session };
    const [created] = await GroupExpense.create(
      [
        {
          _id: expenseId,
          group: input.group._id,
          description: input.description ?? "Group expense",
          amount: input.amount,
          currency: "PKR",
          splitType: "equal",
          payerMember: input.payerMember._id,
          payerAccount: input.payerAccount?._id ?? null,
          participants: shares.map((share) => ({
            member: new mongoose.Types.ObjectId(share.memberId),
            shareAmount: share.shareAmount,
          })),
          occurredAt: new Date(),
          createdBy: input.createdBy._id,
          transactionId: null,
        },
      ],
      opts,
    );

    if (
      input.payerMember.memberType === "registered" &&
      input.payerAccount
    ) {
      const tx = await postGroupExpenseDebit({
        expense: created,
        group: input.group,
        payerMember: input.payerMember,
        session,
      });
      created.transactionId = tx._id;
      await created.save(opts);
    }

    return created;
  });

  return expense;
}

export async function linkMemberAccount(input: {
  group: IGroup;
  member: IGroupMember;
  account: IAccount;
  isPrimary?: boolean;
}) {
  return GroupMemberAccount.create({
    group: input.group._id,
    groupMember: input.member._id,
    account: input.account._id,
    isPrimary: input.isPrimary ?? true,
  });
}

export async function createNotificationFor(input: {
  user: IUser;
  title?: string;
}) {
  return Notification.create({
    user: input.user._id,
    type: "group_expense_added",
    title: input.title ?? "Test",
    body: "Test notification",
    href: "/notifications",
    readAt: null,
  });
}
