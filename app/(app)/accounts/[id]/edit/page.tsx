import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountForm } from "@/components/accounts/AccountForm";
import {
  accountHasTransactions,
  findOwnedAccount,
} from "@/lib/account-access";
import { getSessionUserId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Edit account — FinVault",
};

export default async function EditAccountPage({
  params,
}: PageProps<"/accounts/[id]/edit">) {
  const { id } = await params;
  const userId = await getSessionUserId();

  if (!userId) {
    notFound();
  }

  const account = await findOwnedAccount(userId, id);
  if (!account) {
    notFound();
  }

  const currencyLocked = await accountHasTransactions(account._id);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link
          href="/accounts"
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to accounts
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1a1d29]">
          Edit account
        </h1>
        <p className="mt-2 text-[#5a6072]">Update {account.name}.</p>
      </div>

      <AccountForm
        mode="edit"
        accountId={account._id.toString()}
        currencyLocked={currencyLocked}
        initialValues={{
          name: account.name,
          type: account.type,
          currency: account.currency,
        }}
      />
    </div>
  );
}
