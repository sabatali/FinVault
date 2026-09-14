import mongoose, { type ClientSession } from "mongoose";

import {
  GroupExpenseLedgerError,
  postGroupExpenseDebit,
} from "@/lib/group-expense-ledger";
import { reverseLedgerEntriesForSource } from "@/lib/ledger";
import { roundAmount } from "@/lib/money";
import {
  assertSharesSumToTotal,
  equalShares,
  type EqualShare,
  SharesSumError,
  sumShareAmounts,
} from "@/lib/splits";
import type { CreateGroupExpenseInput } from "@/lib/validators/group-expense";
import { withOptionalTransaction } from "@/lib/with-transaction";
import { Account } from "@/models/Account";
import type { IGroup } from "@/models/Group";
import {
  GroupExpense,
  type IGroupExpense,
  toGroupExpensePublic,
  type GroupExpensePublic,
} from "@/models/GroupExpense";
import {
  GroupMember,
  type IGroupMember,
  type GroupMemberRole,
} from "@/models/GroupMember";
import { GroupMemberAccount } from "@/models/GroupMemberAccount";

export class GroupExpenseMutationError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;
  expected?: number;
  actual?: number;

  constructor(
    message: string,
    status: number,
    options?: {
      code?: string;
      fields?: Record<string, string>;
      expected?: number;
      actual?: number;
    },
  ) {
    super(message);
    this.name = "GroupExpenseMutationError";
    this.status = status;
    this.code = options?.code;
    this.fields = options?.fields;
    this.expected = options?.expected;
    this.actual = options?.actual;
  }
}

/** Admin or the member who created the expense may edit/delete. */
export function canManageGroupExpense(input: {
  userId: string;
  membershipRole: GroupMemberRole;
  expense: IGroupExpense;
}): boolean {
  if (input.membershipRole === "admin") {
    return true;
  }
  return input.expense.createdBy.toString() === input.userId;
}

export function assertCanManageGroupExpense(input: {
  userId: string;
  membershipRole: GroupMemberRole;
  expense: IGroupExpense;
}): void {
  if (!canManageGroupExpense(input)) {
    throw new GroupExpenseMutationError(
      "Only the creator or a group admin can change this expense.",
      403,
      { code: "FORBIDDEN" },
    );
  }
}

export async function buildGroupExpensePublic(
  expense: IGroupExpense,
): Promise<GroupExpensePublic> {
  const memberIds = [
    expense.payerMember.toString(),
    ...expense.participants.map((p) => p.member.toString()),
  ];
  const members = await GroupMember.find({
    _id: { $in: [...new Set(memberIds)] },
  });
  const nameMap = Object.fromEntries(
    members.map((member) => [member._id.toString(), member.displayName]),
  );

  let payerAccountName: string | undefined;
  if (expense.payerAccount) {
    const account = await Account.findById(expense.payerAccount).select("name");
    payerAccountName = account?.name;
  }

  return toGroupExpensePublic(expense, {
    payerDisplayName: nameMap[expense.payerMember.toString()],
    payerAccountName,
    participantNames: nameMap,
  });
}

export function computeParticipantShares(
  amount: number,
  data: Pick<
    CreateGroupExpenseInput,
    "splitType" | "participantMemberIds" | "shares"
  >,
): EqualShare[] {
  if (data.splitType === "equal") {
    const shares = equalShares(amount, data.participantMemberIds);
    if (sumShareAmounts(shares) !== amount) {
      throw new GroupExpenseMutationError(
        "Unable to compute equal shares for this amount.",
        500,
      );
    }
    return shares;
  }

  try {
    return assertSharesSumToTotal(amount, data.shares ?? []);
  } catch (error) {
    if (error instanceof SharesSumError) {
      throw new GroupExpenseMutationError(error.message, 400, {
        code: error.code,
        expected: error.expected,
        actual: error.actual,
      });
    }
    if (error instanceof Error) {
      throw new GroupExpenseMutationError(error.message, 400, {
        fields: { shares: error.message },
      });
    }
    throw error;
  }
}

export async function resolvePayerAccount(input: {
  groupId: string;
  payerMember: IGroupMember;
  payerAccountId?: string | null;
}): Promise<mongoose.Types.ObjectId | null> {
  const { groupId, payerMember, payerAccountId } = input;

  if (payerMember.memberType !== "registered") {
    if (payerAccountId) {
      throw new GroupExpenseMutationError(
        "Guest payers cannot debit an account.",
        400,
        {
          code: "GUEST_CANNOT_LINK_ACCOUNT",
          fields: { payerAccountId: "Remove account for guest payers" },
        },
      );
    }
    return null;
  }

  let link = null as InstanceType<typeof GroupMemberAccount> | null;

  if (payerAccountId) {
    link = await GroupMemberAccount.findOne({
      group: groupId,
      groupMember: payerMember._id,
      account: payerAccountId,
    });
    if (!link) {
      throw new GroupExpenseMutationError(
        "Payer account is not linked to this group.",
        400,
        {
          code: "ACCOUNT_NOT_LINKED",
          fields: { payerAccountId: "Account is not linked for this payer" },
        },
      );
    }
  } else {
    link =
      (await GroupMemberAccount.findOne({
        group: groupId,
        groupMember: payerMember._id,
        isPrimary: true,
      })) ??
      (await GroupMemberAccount.findOne({
        group: groupId,
        groupMember: payerMember._id,
      }).sort({ createdAt: 1 }));
  }

  if (!link) {
    throw new GroupExpenseMutationError(
      "Payer has no linked account for this group.",
      400,
      {
        code: "NO_PAYER_ACCOUNT",
        fields: {
          payerAccountId: "Link an account before recording this expense",
        },
      },
    );
  }

  const account = await Account.findById(link.account);
  if (!account) {
    throw new GroupExpenseMutationError("Payer account not found.", 400, {
      code: "ACCOUNT_NOT_FOUND",
    });
  }

  if (
    !payerMember.user ||
    account.owner.toString() !== payerMember.user.toString()
  ) {
    throw new GroupExpenseMutationError(
      "Payer account does not belong to the payer.",
      400,
      { code: "ACCOUNT_OWNER_MISMATCH" },
    );
  }

  if (account.currency !== "PKR") {
    throw new GroupExpenseMutationError(
      "Only PKR accounts are supported for group expenses.",
      400,
      { fields: { payerAccountId: "Account currency must be PKR" } },
    );
  }

  return account._id;
}

export async function loadMembersForExpenseInput(input: {
  groupId: string;
  payerMemberId: string;
  participantMemberIds: string[];
}): Promise<{ members: IGroupMember[]; payerMember: IGroupMember }> {
  const allMemberIds = [input.payerMemberId, ...input.participantMemberIds];
  const uniqueIds = [...new Set(allMemberIds)];
  const members = await GroupMember.find({
    _id: { $in: uniqueIds },
    group: input.groupId,
  });

  if (members.length !== uniqueIds.length) {
    throw new GroupExpenseMutationError(
      "All participants and the payer must belong to this group.",
      400,
      { code: "INVALID_MEMBERS" },
    );
  }

  const payerMember = members.find(
    (member) => member._id.toString() === input.payerMemberId,
  );
  if (!payerMember) {
    throw new GroupExpenseMutationError(
      "All participants and the payer must belong to this group.",
      400,
      { code: "INVALID_MEMBERS" },
    );
  }

  return { members, payerMember };
}

async function reverseExpenseDebit(
  expense: IGroupExpense,
  session: ClientSession | null,
): Promise<void> {
  await reverseLedgerEntriesForSource({
    sourceType: "group_expense",
    sourceId: expense._id,
    session,
  });
  expense.transactionId = null;
}

/**
 * Deletes a group expense and reverses any linked group_expense ledger debit.
 */
export async function deleteGroupExpense(input: {
  group: IGroup;
  expense: IGroupExpense;
}): Promise<void> {
  void input.group;

  await withOptionalTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    await reverseExpenseDebit(input.expense, session);
    await GroupExpense.deleteOne({ _id: input.expense._id }, opts);
  });
}

/**
 * Updates a group expense: reverse old debit, apply fields, post new debit if needed.
 */
export async function updateGroupExpense(input: {
  group: IGroup;
  expense: IGroupExpense;
  data: CreateGroupExpenseInput;
}): Promise<IGroupExpense> {
  const { group, expense, data } = input;
  const amount = roundAmount(data.amount);
  const groupId = group._id.toString();

  const { payerMember } = await loadMembersForExpenseInput({
    groupId,
    payerMemberId: data.payerMemberId,
    participantMemberIds: data.participantMemberIds,
  });

  const payerAccountId = await resolvePayerAccount({
    groupId,
    payerMember,
    payerAccountId: data.payerAccountId,
  });

  const shares = computeParticipantShares(amount, data);

  await withOptionalTransaction(async (session) => {
    const opts = session ? { session } : undefined;

    await reverseExpenseDebit(expense, session);

    expense.description = data.description;
    expense.amount = amount;
    expense.currency = "PKR";
    expense.splitType = data.splitType;
    expense.payerMember = payerMember._id;
    expense.payerAccount = payerAccountId;
    expense.participants = shares.map((share) => ({
      member: new mongoose.Types.ObjectId(share.memberId),
      shareAmount: share.shareAmount,
    }));
    expense.occurredAt = data.occurredAt;
    expense.transactionId = null;

    await expense.save(opts);

    if (payerMember.memberType === "registered" && payerAccountId) {
      try {
        const transaction = await postGroupExpenseDebit({
          expense,
          group,
          payerMember,
          session,
        });
        expense.transactionId = transaction._id;
        await expense.save(opts);

        if (!expense.transactionId) {
          throw new GroupExpenseLedgerError(
            "Registered payer group expense must have a transaction",
            500,
            "MISSING_GROUP_EXPENSE_TRANSACTION",
          );
        }
      } catch (error) {
        if (!session) {
          await reverseLedgerEntriesForSource({
            sourceType: "group_expense",
            sourceId: expense._id,
            session: null,
          });
        }
        throw error;
      }
    }
  });

  const refreshed = await GroupExpense.findById(expense._id);
  if (!refreshed) {
    throw new GroupExpenseMutationError("Unable to update group expense", 500);
  }
  return refreshed;
}
