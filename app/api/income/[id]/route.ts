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
  updateIncomeSchema,
} from "@/lib/validators/income";
import { Account } from "@/models/Account";
import { Income, toIncomePublic, type IIncome } from "@/models/Income";
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

async function findOwnedIncome(
  userId: string,
  incomeId: string,
): Promise<IIncome | null> {
  if (!mongoose.isValidObjectId(incomeId)) {
    return null;
  }

  await connectDB();
  return Income.findOne({ _id: incomeId, user: userId });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  try {
    const income = await findOwnedIncome(auth.userId, id);
    if (!income) {
      return NextResponse.json({ error: "Income not found" }, { status: 404 });
    }

    const account = await Account.findById(income.account).select("name");

    return NextResponse.json({
      income: toIncomePublic(income, { accountName: account?.name }),
    });
  } catch (error) {
    console.error("Get income error:", error);
    return NextResponse.json(
      { error: "Unable to fetch income" },
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

  const parsed = updateIncomeSchema.safeParse(body);
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
    const income = await findOwnedIncome(auth.userId, id);
    if (!income) {
      return NextResponse.json({ error: "Income not found" }, { status: 404 });
    }

    const data = parsed.data;
    const nextAccountId = data.accountId ?? income.account.toString();
    const nextOccurredAt = data.occurredAt ?? income.occurredAt;
    const nextDescription =
      data.description !== undefined ? data.description : income.description;

    let nextCategory = income.category;
    if (data.categoryId !== undefined) {
      try {
        nextCategory = await resolveUsableCategory({
          userId: auth.userId,
          categoryId: data.categoryId,
          entryKind: "income",
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

    let nextAmountPkr = income.amount;
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
    }

    const ledgerNeedsRewrite =
      nextAccountId !== income.account.toString() ||
      nextAmountPkr !== income.amount ||
      nextOccurredAt.getTime() !== income.occurredAt.getTime();

    const userId = new mongoose.Types.ObjectId(auth.userId);

    await withOptionalTransaction(async (session) => {
      if (ledgerNeedsRewrite) {
        await reverseLedgerEntriesForSource({
          sourceType: "income",
          sourceId: income._id,
          session,
        });

        const transaction = await postLedgerEntry({
          accountId: account._id,
          userId,
          entryType: "credit",
          amount: nextAmountPkr,
          sourceType: "income",
          sourceId: income._id,
          description: nextDescription.trim() || "Income",
          occurredAt: nextOccurredAt,
          currency: "PKR",
          session,
        });

        income.account = account._id;
        income.amount = nextAmountPkr;
        income.currency = "PKR";
        income.occurredAt = nextOccurredAt;
        income.description = nextDescription.trim();
        income.category = nextCategory;
        income.transactionId = transaction._id;
        await income.save(session ? { session } : undefined);
        return;
      }

      income.description = nextDescription.trim();
      income.category = nextCategory;
      await income.save(session ? { session } : undefined);

      if (data.description !== undefined) {
        const txQuery = Transaction.findById(income.transactionId);
        if (session) {
          txQuery.session(session);
        }
        const transaction = await txQuery;
        if (transaction) {
          transaction.description = nextDescription.trim() || "Income";
          await transaction.save(session ? { session } : undefined);
        }
      }
    });

    const refreshed = await Income.findById(income._id);
    if (!refreshed) {
      return NextResponse.json({ error: "Income not found" }, { status: 404 });
    }

    const refreshedAccount = await Account.findById(refreshed.account);

    return NextResponse.json({
      income: toIncomePublic(refreshed, { accountName: refreshedAccount?.name }),
      accountCachedBalance: refreshedAccount?.cachedBalance ?? null,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { error: "This income was already recorded." },
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

    console.error("Update income error:", error);
    return NextResponse.json(
      { error: "Unable to update income" },
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
    const income = await findOwnedIncome(auth.userId, id);
    if (!income) {
      return NextResponse.json({ error: "Income not found" }, { status: 404 });
    }

    await withOptionalTransaction(async (session) => {
      await reverseLedgerEntriesForSource({
        sourceType: "income",
        sourceId: income._id,
        session,
      });

      await income.deleteOne(session ? { session } : undefined);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete income error:", error);
    return NextResponse.json(
      { error: "Unable to delete income" },
      { status: 500 },
    );
  }
}
