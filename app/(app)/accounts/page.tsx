import Link from "next/link";
import { Suspense } from "react";

import { AccountList } from "@/components/accounts/AccountList";

function AccountListFallback() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="hidden h-12 rounded-lg bg-[#e4e7ee] md:block" />
      <div className="h-24 rounded-xl bg-[#e4e7ee] md:h-16" />
      <div className="h-24 rounded-xl bg-[#e4e7ee] md:h-16" />
    </div>
  );
}

export default function AccountsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1d29]">
            Accounts
          </h1>
          <p className="mt-2 text-[#5a6072]">
            Your bank, cash, and wallet accounts in one ledger.
          </p>
        </div>
        <Link
          href="/accounts/new"
          className="inline-flex items-center justify-center rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1e3fae]"
        >
          Add account
        </Link>
      </div>

      <Suspense fallback={<AccountListFallback />}>
        <AccountList />
      </Suspense>
    </div>
  );
}
