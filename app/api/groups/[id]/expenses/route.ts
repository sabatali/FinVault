import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { postGroupExpenseDebit, GroupExpenseLedgerError } from "@/lib/group-expense-ledger";
import {
  assertGroupMember,
  GroupAccessError,
  groupAccessErrorResponse,
} from "@/lib/group-access";
import {
  AccountNotFoundError,
  AccountOwnershipError,
  InvalidLedgerAmountError,
} from "@/lib/ledger-errors";
import { reverseLedgerEntriesForSource } from "@/lib/ledger";
import { roundAmount } from "@/lib/money";
import {
  assertSharesSumToTotal,
  equalShares,
  SharesSumError,
  sumShareAmounts,
} from "@/lib/splits";
import {
  createGroupExpenseSchema,
  formatZodErrors,
} from "@/lib/validators/group-expense";
import { notifyGroupExpenseAdded } from "@/lib/notify";
import { withOptionalTransaction } from "@/lib/with-transaction";
import { Account } from "@/models/Account";
import {
  GroupExpense,
  toGroupExpensePublic,
} from "@/models/GroupExpense";
import { GroupMember } from "@/models/GroupMember";
import { GroupMemberAccount } from "@/models/GroupMemberAccount";

type RouteContext = { params: Promise<{ id: string }> };

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}

async function buildExpensePublic(expense: InstanceType<typeof GroupExpense>) {
  const memberIds = [
    expense.payerMember.toString(),
    ...expense.participants.map((p) => p.member.toString()),
  ];
  const uniqueMemberIds = [...new Set(memberIds)];
  const members = await GroupMember.find({ _id: { $in: uniqueMemberIds } });
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

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId } = await context.params;

  try {
    await assertGroupMember(auth.userId, groupId);
    await connectDB();

    const expenses = await GroupExpense.find({ group: groupId }).sort({
      occurredAt: -1,
      createdAt: -1,
    });

    const publicExpenses = await Promise.all(
      expenses.map((expense) => buildExpensePublic(expense)),
    );

    return NextResponse.json({ expenses: publicExpenses });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    console.error("List group expenses error:", error);
    return NextResponse.json(
      { error: "Unable to fetch group expenses" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createGroupExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: formatZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const amount = roundAmount(data.amount);
  const createdBy = new mongoose.Types.ObjectId(auth.userId);

  try {
    const { group } = await assertGroupMember(auth.userId, groupId);
    await connectDB();

    const allMemberIds = [
      data.payerMemberId,
      ...data.participantMemberIds,
    ];
    const uniqueIds = [...new Set(allMemberIds)];
    const members = await GroupMember.find({
      _id: { $in: uniqueIds },
      group: groupId,
    });

    if (members.length !== uniqueIds.length) {
      return NextResponse.json(
        {
          error: "All participants and the payer must belong to this group.",
          code: "INVALID_MEMBERS",
        },
        { status: 400 },
      );
    }

    const memberMap = new Map(
      members.map((member) => [member._id.toString(), member]),
    );
    const payerMember = memberMap.get(data.payerMemberId)!;

    let payerAccountId: mongoose.Types.ObjectId | null = null;

    if (payerMember.memberType === "registered") {
      let link = null as InstanceType<typeof GroupMemberAccount> | null;

      if (data.payerAccountId) {
        link = await GroupMemberAccount.findOne({
          group: groupId,
          groupMember: payerMember._id,
          account: data.payerAccountId,
        });
        if (!link) {
          return NextResponse.json(
            {
              error: "Payer account is not linked to this group.",
              code: "ACCOUNT_NOT_LINKED",
              fields: { payerAccountId: "Account is not linked for this payer" },
            },
            { status: 400 },
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
        return NextResponse.json(
          {
            error: "Payer has no linked account for this group.",
            code: "NO_PAYER_ACCOUNT",
            fields: {
              payerAccountId: "Link an account before recording this expense",
            },
          },
          { status: 400 },
        );
      }

      const account = await Account.findById(link.account);
      if (!account) {
        return NextResponse.json(
          { error: "Payer account not found.", code: "ACCOUNT_NOT_FOUND" },
          { status: 400 },
        );
      }

      if (!payerMember.user || account.owner.toString() !== payerMember.user.toString()) {
        return NextResponse.json(
          {
            error: "Payer account does not belong to the payer.",
            code: "ACCOUNT_OWNER_MISMATCH",
          },
          { status: 400 },
        );
      }

      if (account.currency !== "PKR") {
        return NextResponse.json(
          {
            error: "Only PKR accounts are supported for group expenses.",
            fields: { payerAccountId: "Account currency must be PKR" },
          },
          { status: 400 },
        );
      }

      payerAccountId = account._id;
    } else if (data.payerAccountId) {
      return NextResponse.json(
        {
          error: "Guest payers cannot debit an account.",
          code: "GUEST_CANNOT_LINK_ACCOUNT",
          fields: { payerAccountId: "Remove account for guest payers" },
        },
        { status: 400 },
      );
    }

    let shares;
    try {
      if (data.splitType === "equal") {
        shares = equalShares(amount, data.participantMemberIds);
        if (sumShareAmounts(shares) !== amount) {
          return NextResponse.json(
            { error: "Unable to compute equal shares for this amount." },
            { status: 500 },
          );
        }
      } else {
        shares = assertSharesSumToTotal(amount, data.shares ?? []);
      }
    } catch (error) {
      if (error instanceof SharesSumError) {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            expected: error.expected,
            actual: error.actual,
          },
          { status: 400 },
        );
      }
      if (error instanceof Error) {
        return NextResponse.json(
          { error: error.message, fields: { shares: error.message } },
          { status: 400 },
        );
      }
      throw error;
    }

    const expenseId = await withOptionalTransaction(async (session) => {
      const newExpenseId = new mongoose.Types.ObjectId();
      const createOptions = session ? { session } : undefined;

      const expenseDocs = await GroupExpense.create(
        [
          {
            _id: newExpenseId,
            group: group._id,
            description: data.description,
            amount,
            currency: "PKR",
            splitType: data.splitType,
            payerMember: payerMember._id,
            payerAccount: payerAccountId,
            participants: shares.map((share) => ({
              member: new mongoose.Types.ObjectId(share.memberId),
              shareAmount: share.shareAmount,
            })),
            occurredAt: data.occurredAt,
            createdBy,
            transactionId: null,
          },
        ],
        createOptions,
      );

      const expense = expenseDocs[0]!;

      if (payerMember.memberType === "registered" && payerAccountId) {
        try {
          const transaction = await postGroupExpenseDebit({
            expense,
            group,
            payerMember,
            session,
          });
          expense.transactionId = transaction._id;
          await expense.save(createOptions);

          if (!expense.transactionId) {
            throw new Error(
              "Registered payer group expense must have a transaction",
            );
          }
        } catch (error) {
          if (!session) {
            await reverseLedgerEntriesForSource({
              sourceType: "group_expense",
              sourceId: newExpenseId,
              session: null,
            });
            await GroupExpense.deleteOne({ _id: newExpenseId });
          }
          throw error;
        }
      }

      return newExpenseId;
    });

    const expense = await GroupExpense.findById(expenseId);
    if (!expense) {
      return NextResponse.json(
        { error: "Unable to create group expense" },
        { status: 500 },
      );
    }

    if (
      payerMember.memberType === "registered" &&
      expense.payerAccount &&
      !expense.transactionId
    ) {
      return NextResponse.json(
        {
          error: "Group expense debit failed to record a transaction.",
          code: "MISSING_GROUP_EXPENSE_TRANSACTION",
        },
        { status: 500 },
      );
    }

    try {
      await notifyGroupExpenseAdded({
        group,
        expense,
        actorUserId: auth.userId,
      });
    } catch (error) {
      console.error("Group expense notification error:", error);
    }

    return NextResponse.json(
      { expense: await buildExpensePublic(expense) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    if (error instanceof GroupExpenseLedgerError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { error: "This group expense was already recorded." },
        { status: 409 },
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

    console.error("Create group expense error:", error);
    return NextResponse.json(
      { error: "Unable to create group expense" },
      { status: 500 },
    );
  }
}
