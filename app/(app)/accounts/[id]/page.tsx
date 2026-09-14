import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountHeader } from "@/components/accounts/AccountHeader";
import { TransactionTable } from "@/components/accounts/TransactionTable";
import { findOwnedAccount } from "@/lib/account-access";
import { sumBalance } from "@/lib/ledger";
import { getSessionUserId } from "@/lib/session";
import { toTransactionPublicWithLinks } from "@/lib/transaction-links";
import { Transaction } from "@/models/Transaction";

const DEFAULT_PAGE_SIZE = 50;

export async function generateMetadata({
  params,
}: PageProps<"/accounts/[id]">): Promise<Metadata> {
  const { id } = await params;
  const userId = await getSessionUserId();

  if (!userId) {
    return { title: "Account — FinVault" };
  }

  const account = await findOwnedAccount(userId, id);

  return {
    title: account ? `${account.name} — FinVault` : "Account — FinVault",
  };
}

export default async function AccountDetailPage({
  params,
}: PageProps<"/accounts/[id]">) {
  const { id } = await params;
  const userId = await getSessionUserId();

  if (!userId) {
    notFound();
  }

  const account = await findOwnedAccount(userId, id);
  if (!account) {
    notFound();
  }

  const [ledgerBalance, total, transactions] = await Promise.all([
    sumBalance(account._id),
    Transaction.countDocuments({ account: account._id }),
    Transaction.find({ account: account._id })
      .sort({ occurredAt: -1 })
      .limit(DEFAULT_PAGE_SIZE),
  ]);

  const showMismatchWarning =
    process.env.NODE_ENV === "development" &&
    ledgerBalance !== account.cachedBalance;

  if (ledgerBalance !== account.cachedBalance) {
    console.warn(
      `Balance mismatch for account ${id}: cached=${account.cachedBalance}, ledger=${ledgerBalance}`,
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link
          href="/accounts"
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to accounts
        </Link>
      </div>

      <AccountHeader
        name={account.name}
        type={account.type}
        currency={account.currency}
        balance={ledgerBalance}
        showMismatchWarning={showMismatchWarning}
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/expenses/new?accountId=${account._id.toString()}`}
          className="inline-flex rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae]"
        >
          Add expense
        </Link>
        <Link
          href={`/income/new?accountId=${account._id.toString()}`}
          className="inline-flex rounded-lg border border-[#e4e7ee] bg-white px-4 py-2.5 text-sm font-semibold text-[#1a1d29] hover:bg-[#f4f6fb]"
        >
          Add income
        </Link>
      </div>

      <section className="mt-8" aria-labelledby="transaction-history-heading">
        <h2
          id="transaction-history-heading"
          className="mb-4 text-lg font-semibold text-[#1a1d29]"
        >
          Transaction history
        </h2>

        <TransactionTable
          accountId={account._id.toString()}
          initialData={{
            transactions: await toTransactionPublicWithLinks(transactions),
            total,
            page: 1,
            limit: DEFAULT_PAGE_SIZE,
          }}
        />
      </section>
    </div>
  );
}
