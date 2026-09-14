import { NextRequest, NextResponse } from "next/server";

import { findOwnedAccount } from "@/lib/account-access";
import { requireAuth } from "@/lib/auth";
import { sumBalance } from "@/lib/ledger";
import { toTransactionPublicWithLinks } from "@/lib/transaction-links";
import { Transaction } from "@/models/Transaction";

type RouteContext = { params: Promise<{ id: string }> };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT),
  );

  return { page, limit, skip: (page - 1) * limit };
}

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

    const { page, limit, skip } = parsePagination(request.nextUrl.searchParams);

    const [ledgerBalance, total, transactions] = await Promise.all([
      sumBalance(account._id),
      Transaction.countDocuments({ account: account._id }),
      Transaction.find({ account: account._id })
        .sort({ occurredAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    if (ledgerBalance !== account.cachedBalance) {
      console.warn(
        `Balance mismatch for account ${id}: cached=${account.cachedBalance}, ledger=${ledgerBalance}`,
      );
    }

    return NextResponse.json({
      accountId: account._id.toString(),
      ledgerBalance,
      cachedBalance: account.cachedBalance,
      page,
      limit,
      total,
      transactions: await toTransactionPublicWithLinks(transactions),
    });
  } catch (error) {
    console.error("List account transactions error:", error);
    return NextResponse.json(
      { error: "Unable to fetch transactions" },
      { status: 500 },
    );
  }
}
