import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClaimSignupBanners } from "@/components/auth/ClaimSignupBanners";
import { AccountBalanceCards } from "@/components/dashboard/AccountBalanceCards";
import { AccountCompositionChart } from "@/components/dashboard/AccountCompositionChart";
import { FlowSummary } from "@/components/dashboard/FlowSummary";
import { GroupExposure } from "@/components/dashboard/GroupExposure";
import { NetWorthHero } from "@/components/dashboard/NetWorthHero";
import { PeriodSelect } from "@/components/dashboard/PeriodSelect";
import { SpendByCategory } from "@/components/dashboard/SpendByCategory";
import { getCombinedDashboard } from "@/lib/dashboard";
import {
  DASHBOARD_PERIOD_LABELS,
  DASHBOARD_TIMEZONE,
  isDashboardPeriodKey,
  type DashboardPeriodKey,
} from "@/lib/period";
import { getSessionUserId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dashboard — FinVault",
};

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const userId = await getSessionUserId();
  if (!userId) {
    notFound();
  }

  const params = await searchParams;
  const periodParam =
    typeof params.period === "string" ? params.period : "this_month";
  const period: DashboardPeriodKey = isDashboardPeriodKey(periodParam)
    ? periodParam
    : "this_month";

  const dashboard = await getCombinedDashboard(userId, period);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <ClaimSignupBanners inviteWarning={params.inviteWarning === "1"} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1d29]">
            Dashboard
          </h1>
          <p className="mt-2 text-[#5a6072]">
            Net worth from your accounts, plus group IOUs · dates use{" "}
            {DASHBOARD_TIMEZONE}.
          </p>
        </div>
        <PeriodSelect value={period} />
      </div>

      {dashboard.accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e4e7ee] bg-white p-10 text-center">
          <p className="font-medium text-[#1a1d29]">No accounts yet.</p>
          <p className="mt-2 text-sm text-[#5a6072]">
            Add a bank, cash, or wallet account to see your net worth.
          </p>
          <Link
            href="/accounts/new"
            className="mt-6 inline-flex rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae]"
          >
            Add account
          </Link>
        </div>
      ) : (
        <>
          <NetWorthHero
            netWorth={dashboard.netWorth}
            accountsSum={dashboard.accountsSum}
            accountCount={dashboard.accounts.length}
            currency={dashboard.currency}
          />

          <section aria-labelledby="accounts-heading">
            <h2
              id="accounts-heading"
              className="mb-3 text-lg font-semibold text-[#1a1d29]"
            >
              Accounts
            </h2>
            <AccountBalanceCards
              accounts={dashboard.accounts}
              currency={dashboard.currency}
            />
          </section>

          <AccountCompositionChart
            accounts={dashboard.accounts}
            currency={dashboard.currency}
          />

          <section aria-labelledby="flow-heading" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2
                id="flow-heading"
                className="text-lg font-semibold text-[#1a1d29]"
              >
                Cash flow · {DASHBOARD_PERIOD_LABELS[period]}
              </h2>
            </div>
            <FlowSummary
              incomeTotal={dashboard.incomeTotal}
              expenseTotal={dashboard.expenseTotal}
              currency={dashboard.currency}
            />
          </section>

          <section aria-labelledby="spend-heading">
            <h2 id="spend-heading" className="sr-only">
              Spend by category
            </h2>
            <SpendByCategory
              rows={dashboard.spendByCategory}
              expenseTotal={dashboard.expenseTotal}
              currency={dashboard.currency}
              groupSpendByGroup={dashboard.groupSpendByGroup}
            />
          </section>
        </>
      )}

      <GroupExposure
        summary={dashboard.groupSummary}
        currency={dashboard.currency}
      />
    </div>
  );
}
