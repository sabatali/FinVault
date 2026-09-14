import type { Metadata } from "next";
import Link from "next/link";

import { AccountForm } from "@/components/accounts/AccountForm";

export const metadata: Metadata = {
  title: "New account — FinVault",
};

export default function NewAccountPage() {
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
          Add account
        </h1>
        <p className="mt-2 text-[#5a6072]">
          Create a bank, cash, or wallet account for your personal ledger.
        </p>
      </div>

      <AccountForm mode="create" />
    </div>
  );
}
