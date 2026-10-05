import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import {
  accountHasTransactions,
  findOwnedAccount,
  getAccountDeletePolicy,
} from "@/lib/account-access";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { sumBalance } from "@/lib/ledger";
import { reverseLedgerEntriesForSource } from "@/lib/ledger";
import { withOptionalTransaction } from "@/lib/with-transaction";
import {
  formatZodErrors,
  updateAccountSchema,
} from "@/lib/validators/account";
import { toAccountPublic } from "@/models/Account";
import { GroupMemberAccount } from "@/models/GroupMemberAccount";
import { GroupTransfer } from "@/models/GroupTransfer";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  try {
    const account = await findOwnedAccount(auth.userId, id);
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const ledgerBalance = await sumBalance(account._id);

    if (ledgerBalance !== account.cachedBalance) {
      console.warn(
        `Balance mismatch for account ${id}: cached=${account.cachedBalance}, ledger=${ledgerBalance}`,
      );
    }

    return NextResponse.json({
      account: toAccountPublic(account),
      ledgerBalance,
      cachedBalance: account.cachedBalance,
    });
  } catch (error) {
    console.error("Get account error:", error);
    return NextResponse.json(
      { error: "Unable to fetch account" },
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

  const parsed = updateAccountSchema.safeParse(body);
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
    await connectDB();

    const account = await findOwnedAccount(auth.userId, id);
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const { name, type, currency } = parsed.data;

    if (currency && currency !== account.currency) {
      const hasTransactions = await accountHasTransactions(account._id);
      if (hasTransactions) {
        return NextResponse.json(
          {
            error: "Currency cannot be changed after transactions exist",
            code: "CURRENCY_LOCKED",
          },
          { status: 400 },
        );
      }
      account.currency = currency;
    }

    if (name) {
      account.name = name;
    }

    if (type) {
      account.type = type;
    }

    await account.save();

    return NextResponse.json({ account: toAccountPublic(account) });
  } catch (error) {
    console.error("Update account error:", error);
    return NextResponse.json(
      { error: "Unable to update account" },
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

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    await connectDB();

    const account = await findOwnedAccount(auth.userId, id);
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const groupLink = await GroupMemberAccount.exists({
      account: account._id,
    });
    const pendingTransfer = await GroupTransfer.exists({
      status: "pending",
      $or: [
        { fromAccount: account._id },
        { toAccount: account._id },
      ],
    });
    if (groupLink || pendingTransfer) {
      return NextResponse.json(
        {
          error:
            "This account is linked to a group or a pending settlement and cannot be deleted.",
          code: "ACCOUNT_IN_USE_BY_GROUP",
        },
        { status: 409 },
      );
    }

    const policy = await getAccountDeletePolicy(account._id);

    if (!policy.canDelete) {
      return NextResponse.json(
        {
          error: "Account has transactions and cannot be deleted",
          code: "ACCOUNT_NOT_EMPTY",
        },
        { status: 409 },
      );
    }

    if (policy.reverseOpeningBalance) {
      await withOptionalTransaction(async (session) => {
        await reverseLedgerEntriesForSource({
          sourceType: "opening_balance",
          sourceId: account._id,
          session,
        });

        const deleteOptions = session ? { session } : undefined;
        await account.deleteOne(deleteOptions);
      });
    } else {
      await account.deleteOne();
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "Unable to delete account" },
      { status: 500 },
    );
  }
}
