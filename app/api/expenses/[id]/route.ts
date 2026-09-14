import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { findOwnedAccount } from "@/lib/account-access";
import { requireAuth } from "@/lib/auth";
import {
  CategoryAccessError,
  resolveUsableCategory,
} from "@/lib/category-access";
import { connectDB } from "@/lib/db";
import {
  AccountNotFoundError,
  AccountOwnershipError,
  InvalidLedgerAmountError,
} from "@/lib/ledger-errors";
import {
  postLedgerEntry,
  reverseLedgerEntriesForSource,
} from "@/lib/ledger";
import { toLedgerPkr } from "@/lib/fx";
import { roundAmount } from "@/lib/money";
import { withOptionalTransaction } from "@/lib/with-transaction";
import {
  formatZodErrors,
  updateExpenseSchema,
} from "@/lib/validators/expense";
import { Account } from "@/models/Account";
import { Expense, toExpensePublic, type IExpense } from "@/models/Expense";
import { Transaction } from "@/models/Transaction";

type RouteContext = { params: Promise<{ id: string }> };

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}

async function findOwnedExpense(
  userId: string,
  expenseId: string,
): Promise<IExpense | null> {
  if (!mongoose.isValidObjectId(expenseId)) {
    return null;
  }

  await connectDB();
  return Expense.findOne({ _id: expenseId, user: userId });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  try {
    const expense = await findOwnedExpense(auth.userId, id);
    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const account = await Account.findById(expense.account).select("name");

    return NextResponse.json({
      expense: toExpensePublic(expense, { accountName: account?.name }),
    });
  } catch (error) {
    console.error("Get expense error:", error);
    return NextResponse.json(
      { error: "Unable to fetch expense" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: formatZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  try {
    const expense = await findOwnedExpense(auth.userId, id);
    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const data = parsed.data;
    const nextAccountId = data.accountId ?? expense.account.toString();
    const nextOccurredAt = data.occurredAt ?? expense.occurredAt;
    const nextDescription =
      data.description !== undefined ? data.description : expense.description;

    let nextCategory = expense.category;
    if (data.categoryId !== undefined) {
      try {
        nextCategory = await resolveUsableCategory({
          userId: auth.userId,
          categoryId: data.categoryId,
          entryKind: "expense",
        });
      } catch (error) {
        if (error instanceof CategoryAccessError) {
          return NextResponse.json(
            { error: error.message, fields: { categoryId: error.message } },
            { status: 400 },
          );
        }
        throw error;
      }
    }

    const account = await findOwnedAccount(auth.userId, nextAccountId);
    if (!account) {
      return NextResponse.json(
        { error: "Account not found", fields: { accountId: "Account not found" } },
        { status: 404 },
      );
    }

    let nextAmountPkr = expense.amount;
    if (data.amount !== undefined) {
      try {
        nextAmountPkr = toLedgerPkr(roundAmount(data.amount), account.currency);
      } catch {
        return NextResponse.json(
          {
            error: "Unable to convert amount",
            fields: { amount: "Missing FX rate for this account currency" },
          },
          { status: 400 },
        );
      }
    } else if (nextAccountId !== expense.account.toString()) {
      // Amount field still PKR from old expense; keep PKR when only account changes
      nextAmountPkr = expense.amount;
    }

    const ledgerNeedsRewrite =
      nextAccountId !== expense.account.toString() ||
      nextAmountPkr !== expense.amount ||
      nextOccurredAt.getTime() !== expense.occurredAt.getTime();

    const userId = new mongoose.Types.ObjectId(auth.userId);

    await withOptionalTransaction(async (session) => {
      if (ledgerNeedsRewrite) {
        await reverseLedgerEntriesForSource({
          sourceType: "expense",
          sourceId: expense._id,
          session,
        });

        const transaction = await postLedgerEntry({
          accountId: account._id,
          userId,
          entryType: "debit",
          amount: nextAmountPkr,
          sourceType: "expense",
          sourceId: expense._id,
          description: nextDescription.trim() || "Expense",
          occurredAt: nextOccurredAt,
          currency: "PKR",
          session,
        });

        expense.account = account._id;
        expense.amount = nextAmountPkr;
        expense.currency = "PKR";
        expense.occurredAt = nextOccurredAt;
        expense.description = nextDescription.trim();
        expense.category = nextCategory;
        expense.transactionId = transaction._id;
        await expense.save(session ? { session } : undefined);
        return;
      }

      expense.description = nextDescription.trim();
      expense.category = nextCategory;
      await expense.save(session ? { session } : undefined);

      if (data.description !== undefined) {
        const txQuery = Transaction.findById(expense.transactionId);
        if (session) {
          txQuery.session(session);
        }
        const transaction = await txQuery;
        if (transaction) {
          transaction.description = nextDescription.trim() || "Expense";
          await transaction.save(session ? { session } : undefined);
        }
      }
    });

    const refreshed = await Expense.findById(expense._id);
    if (!refreshed) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const refreshedAccount = await Account.findById(refreshed.account);

    return NextResponse.json({
      expense: toExpensePublic(refreshed, { accountName: refreshedAccount?.name }),
      accountCachedBalance: refreshedAccount?.cachedBalance ?? null,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { error: "This expense was already recorded." },
        { status: 409 },
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

    console.error("Update expense error:", error);
    return NextResponse.json(
      { error: "Unable to update expense" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  try {
    const expense = await findOwnedExpense(auth.userId, id);
    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    await withOptionalTransaction(async (session) => {
      await reverseLedgerEntriesForSource({
        sourceType: "expense",
        sourceId: expense._id,
        session,
      });

      await expense.deleteOne(session ? { session } : undefined);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete expense error:", error);
    return NextResponse.json(
      { error: "Unable to delete expense" },
      { status: 500 },
    );
  }
}
