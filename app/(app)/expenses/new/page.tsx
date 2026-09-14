import type { Metadata } from "next";
import Link from "next/link";

import { ExpenseForm } from "@/components/expenses/ExpenseForm";

export const metadata: Metadata = {
  title: "Add expense — FinVault",
};

export default async function NewExpensePage({
  searchParams,
}: PageProps<"/expenses/new">) {
  const params = await searchParams;
  const defaultAccountId =
    typeof params.accountId === "string" ? params.accountId : undefined;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link
          href="/expenses"
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to expenses
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1a1d29]">
          Add expense
        </h1>
        <p className="mt-2 text-[#5a6072]">
          Debit one of your accounts for a purchase.
        </p>
      </div>

      <ExpenseForm mode="create" defaultAccountId={defaultAccountId} />
    </div>
  );
}
