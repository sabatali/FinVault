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
  createExpenseSchema,
  formatZodErrors,
} from "@/lib/validators/expense";
import { Account } from "@/models/Account";
import { Expense, toExpensePublic } from "@/models/Expense";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}

function parseListParams(searchParams: URLSearchParams) {
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const rawLimit = Number.parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT),
  );

  const accountId = searchParams.get("accountId") ?? undefined;
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  return { page, limit, skip: (page - 1) * limit, accountId, categoryId, from, to };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    await connectDB();

    const { page, limit, skip, accountId, categoryId, from, to } = parseListParams(
      request.nextUrl.searchParams,
    );

    const filter: Record<string, unknown> = {
      user: auth.userId,
    };

    if (accountId) {
      if (!mongoose.isValidObjectId(accountId)) {
        return NextResponse.json(
          { error: "Validation failed", fields: { accountId: "Invalid id" } },
          { status: 400 },
        );
      }
      filter.account = accountId;
    }

    if (categoryId) {
      if (categoryId === "uncategorized") {
        filter.category = null;
      } else if (!mongoose.isValidObjectId(categoryId)) {
        return NextResponse.json(
          { error: "Validation failed", fields: { categoryId: "Invalid id" } },
          { status: 400 },
        );
      } else {
        filter.category = categoryId;
      }
    }

    if (from || to) {
      const occurredAt: Record<string, Date> = {};
      if (from) {
        const fromDate = new Date(from);
        if (Number.isNaN(fromDate.getTime())) {
          return NextResponse.json(
            { error: "Validation failed", fields: { from: "Invalid date" } },
            { status: 400 },
          );
        }
        occurredAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (Number.isNaN(toDate.getTime())) {
          return NextResponse.json(
            { error: "Validation failed", fields: { to: "Invalid date" } },
            { status: 400 },
          );
        }
        occurredAt.$lte = toDate;
      }
      filter.occurredAt = occurredAt;
    }

    const [total, expenses] = await Promise.all([
      Expense.countDocuments(filter),
      Expense.find(filter).sort({ occurredAt: -1 }).skip(skip).limit(limit),
    ]);

    const accountIds = [...new Set(expenses.map((e) => e.account.toString()))];
    const accounts = await Account.find({
      _id: { $in: accountIds },
      owner: auth.userId,
    }).select("name");
    const accountNames = new Map(
      accounts.map((account) => [account._id.toString(), account.name]),
    );

    return NextResponse.json({
      page,
      limit,
      total,
      expenses: expenses.map((expense) =>
        toExpensePublic(expense, { accountName: accountNames.get(expense.account.toString()) }),
      ),
    });
  } catch (error) {
    console.error("List expenses error:", error);
    return NextResponse.json(
      { error: "Unable to fetch expenses" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: formatZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  const { accountId, amount, occurredAt, description, categoryId } = parsed.data;
  const userId = new mongoose.Types.ObjectId(auth.userId);

  try {
    await connectDB();

    const account = await findOwnedAccount(auth.userId, accountId);
    if (!account) {
      return NextResponse.json(
        { error: "Account not found", fields: { accountId: "Account not found" } },
        { status: 404 },
      );
    }

    let amountPkr: number;
    try {
      amountPkr = toLedgerPkr(roundAmount(amount), account.currency);
    } catch {
      return NextResponse.json(
        {
          error: "Unable to convert amount",
          fields: { amount: "Missing FX rate for this account currency" },
        },
        { status: 400 },
      );
    }

    let resolvedCategory: mongoose.Types.ObjectId | null = null;
    try {
      resolvedCategory = await resolveUsableCategory({
        userId: auth.userId,
        categoryId,
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

    const expenseId = await withOptionalTransaction(async (session) => {
      const newExpenseId = new mongoose.Types.ObjectId();
      const createOptions = session ? { session } : undefined;

      const transaction = await postLedgerEntry({
        accountId: account._id,
        userId,
        entryType: "debit",
        amount: amountPkr,
        sourceType: "expense",
        sourceId: newExpenseId,
        description: description?.trim() || "Expense",
        occurredAt,
        currency: "PKR",
        session,
      });

      try {
        await Expense.create(
          [
            {
              _id: newExpenseId,
              user: userId,
              account: account._id,
              amount: amountPkr,
              currency: "PKR",
              description: description?.trim() ?? "",
              category: resolvedCategory,
              occurredAt,
              transactionId: transaction._id,
            },
          ],
          createOptions,
        );
      } catch (error) {
        if (!session) {
          await reverseLedgerEntriesForSource({
            sourceType: "expense",
            sourceId: newExpenseId,
            session: null,
          });
        }
        throw error;
      }

      return newExpenseId;
    });

    const [expense, refreshedAccount] = await Promise.all([
      Expense.findById(expenseId),
      Account.findById(account._id),
    ]);

    if (!expense) {
      return NextResponse.json(
        { error: "Unable to create expense" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        expense: toExpensePublic(expense, { accountName: account.name }),
        accountCachedBalance: refreshedAccount?.cachedBalance ?? null,
      },
      { status: 201 },
    );
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

    console.error("Create expense error:", error);
    return NextResponse.json(
      { error: "Unable to create expense" },
      { status: 500 },
    );
  }
}
