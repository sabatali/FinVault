import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getFxSnapshot, toBase } from "@/lib/fx";
import { postLedgerEntry } from "@/lib/ledger";
import { roundAmount } from "@/lib/money";
import { withOptionalTransaction } from "@/lib/with-transaction";
import {
  createAccountSchema,
  formatZodErrors,
} from "@/lib/validators/account";
import { Account, toAccountPublic } from "@/models/Account";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    await connectDB();

    const accounts = await Account.find({ owner: auth.userId }).sort({
      createdAt: -1,
    });

    return NextResponse.json({
      accounts: accounts.map(toAccountPublic),
    });
  } catch (error) {
    console.error("List accounts error:", error);
    return NextResponse.json(
      { error: "Unable to fetch accounts" },
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

  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: formatZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  const { name, type, currency, openingBalance } = parsed.data;
  const accountCurrency = currency ?? "PKR";
  const openingInAccountCurrency = roundAmount(openingBalance ?? 0);
  const fx = getFxSnapshot();
  let openingPkr: number;
  try {
    openingPkr = toBase(openingInAccountCurrency, accountCurrency, fx.rates);
  } catch {
    return NextResponse.json(
      {
        error: "Unable to convert opening balance",
        fields: { currency: "Missing FX rate for this currency" },
      },
      { status: 400 },
    );
  }
  const ownerId = new mongoose.Types.ObjectId(auth.userId);

  try {
    await connectDB();

    const createdAccountId = await withOptionalTransaction(async (session) => {
      const accountId = new mongoose.Types.ObjectId();
      const createOptions = session ? { session } : undefined;

      await Account.create(
        [
          {
            _id: accountId,
            owner: ownerId,
            name,
            type,
            currency: accountCurrency,
            openingBalance: openingPkr,
            cachedBalance: 0,
          },
        ],
        createOptions,
      );

      if (openingPkr !== 0) {
        const entryType = openingPkr > 0 ? "credit" : "debit";
        const amount = Math.abs(openingPkr);

        await postLedgerEntry({
          accountId,
          userId: ownerId,
          entryType,
          amount,
          sourceType: "opening_balance",
          sourceId: accountId,
          description:
            accountCurrency === "PKR"
              ? "Opening balance"
              : `Opening balance (${openingInAccountCurrency} ${accountCurrency})`,
          currency: "PKR",
          session,
        });
      }

      return accountId;
    });

    const account = await Account.findById(createdAccountId);
    if (!account) {
      return NextResponse.json(
        { error: "Unable to create account" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { account: toAccountPublic(account) },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create account error:", error);
    return NextResponse.json(
      { error: "Unable to create account" },
      { status: 500 },
    );
  }
}
