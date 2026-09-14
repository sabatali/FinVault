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
  createIncomeSchema,
  formatZodErrors,
} from "@/lib/validators/income";
import { Account } from "@/models/Account";
import { Income, toIncomePublic } from "@/models/Income";

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

    const [total, incomes] = await Promise.all([
      Income.countDocuments(filter),
      Income.find(filter).sort({ occurredAt: -1 }).skip(skip).limit(limit),
    ]);

    const accountIds = [...new Set(incomes.map((row) => row.account.toString()))];
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
      incomes: incomes.map((income) =>
        toIncomePublic(income, { accountName: accountNames.get(income.account.toString()) }),
      ),
    });
  } catch (error) {
    console.error("List income error:", error);
    return NextResponse.json(
      { error: "Unable to fetch income" },
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

  const parsed = createIncomeSchema.safeParse(body);
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

    const incomeId = await withOptionalTransaction(async (session) => {
      const newIncomeId = new mongoose.Types.ObjectId();
      const createOptions = session ? { session } : undefined;

      const transaction = await postLedgerEntry({
        accountId: account._id,
        userId,
        entryType: "credit",
        amount: amountPkr,
        sourceType: "income",
        sourceId: newIncomeId,
        description: description?.trim() || "Income",
        occurredAt,
        currency: "PKR",
        session,
      });

      try {
        await Income.create(
          [
            {
              _id: newIncomeId,
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
            sourceType: "income",
            sourceId: newIncomeId,
            session: null,
          });
        }
        throw error;
      }

      return newIncomeId;
    });

    const [income, refreshedAccount] = await Promise.all([
      Income.findById(incomeId),
      Account.findById(account._id),
    ]);

    if (!income) {
      return NextResponse.json(
        { error: "Unable to create income" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        income: toIncomePublic(income, { accountName: account.name }),
        accountCachedBalance: refreshedAccount?.cachedBalance ?? null,
      },
      { status: 201 },
    );
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

    console.error("Create income error:", error);
    return NextResponse.json(
      { error: "Unable to create income" },
      { status: 500 },
    );
  }
}
