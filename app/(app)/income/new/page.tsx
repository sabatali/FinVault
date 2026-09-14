import type { Metadata } from "next";
import Link from "next/link";

import { IncomeForm } from "@/components/income/IncomeForm";

export const metadata: Metadata = {
  title: "Add income — FinVault",
};

export default async function NewIncomePage({
  searchParams,
}: PageProps<"/income/new">) {
  const params = await searchParams;
  const defaultAccountId =
    typeof params.accountId === "string" ? params.accountId : undefined;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link
          href="/income"
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to income
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1a1d29]">
          Add income
        </h1>
        <p className="mt-2 text-[#5a6072]">
          Credit one of your accounts for salary, refunds, or gifts.
        </p>
      </div>

      <IncomeForm mode="create" defaultAccountId={defaultAccountId} />
    </div>
  );
}
