"use client";

import Link from "next/link";

import { useMoney } from "@/components/currency/CurrencyProvider";
import type { GroupSummary } from "@/lib/dashboard";
import { toPaisa } from "@/lib/splits";

interface GroupExposureProps {
  summary: GroupSummary;
  currency?: string;
}

export function GroupExposure({ summary }: GroupExposureProps) {
  const { format } = useMoney();

  if (summary.groups.length === 0) {
    return (
      <section
        aria-labelledby="group-exposure-heading"
        className="rounded-xl border border-dashed border-[#e4e7ee] bg-white p-8 text-center"
      >
        <h2
          id="group-exposure-heading"
          className="text-lg font-semibold text-[#1a1d29]"
        >
          Groups
        </h2>
        <p className="mt-2 text-sm text-[#5a6072]">
          You&apos;re not in any groups yet. Shared trips and roommate expenses
          will show here.
        </p>
        <Link
          href="/groups/new"
          className="mt-5 inline-flex rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae]"
        >
          Create a group
        </Link>
      </section>
    );
  }

  const allSettled = summary.groups.every((group) => toPaisa(group.net) === 0);

  return (
    <section aria-labelledby="group-exposure-heading" className="space-y-4">
      <div>
        <h2
          id="group-exposure-heading"
          className="text-lg font-semibold text-[#1a1d29]"
        >
          Group balances
        </h2>
        <p className="mt-1 text-sm text-[#5a6072]">
          Who should settle with you — not added to net worth.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#e4e7ee] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5a6072]">
            You&apos;re owed
          </p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-700">
            {format(summary.owedToYou)}
          </p>
        </div>
        <div className="rounded-xl border border-[#e4e7ee] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5a6072]">
            You owe
          </p>
          <p className="mt-2 text-2xl font-extrabold text-red-700">
            {format(summary.youOwe)}
          </p>
        </div>
      </div>

      {allSettled ? (
        <p className="rounded-xl border border-dashed border-[#e4e7ee] bg-[#fafbfd] px-4 py-6 text-center text-sm text-[#5a6072]">
          Everyone is settled across your groups.
        </p>
      ) : (
        <ul className="divide-y divide-[#e4e7ee] overflow-hidden rounded-xl border border-[#e4e7ee] bg-white">
          {summary.groups.map((group) => {
            const netZero = toPaisa(group.net) === 0;
            const owed = group.net > 0;
            const sentence = netZero
              ? `${group.name}: settled`
              : owed
                ? `${group.name}: you're owed ${format(group.net)}`
                : `${group.name}: you owe ${format(Math.abs(group.net))}`;

            return (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[#f8f9fd]"
                  aria-label={sentence}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1a1d29]">{group.name}</p>
                    <p className="text-sm text-[#5a6072]">
                      {netZero ? "Settled" : owed ? "You're owed" : "You owe"}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-sm font-bold ${
                      netZero
                        ? "text-[#5a6072]"
                        : owed
                          ? "text-emerald-700"
                          : "text-red-700"
                    }`}
                  >
                    {netZero
                      ? format(0)
                      : `${owed ? "+" : "−"}${format(Math.abs(group.net))}`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function GroupExposureSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-6 w-40 rounded bg-[#eef1f8]" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-24 rounded-xl bg-[#eef1f8]" />
        <div className="h-24 rounded-xl bg-[#eef1f8]" />
      </div>
      <div className="h-32 rounded-xl bg-[#eef1f8]" />
    </div>
  );
}
