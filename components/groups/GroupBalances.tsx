"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import { owedAmountLine, owesAmountLine } from "@/lib/owes-labels";
import { toPaisa } from "@/lib/splits";
import type { GroupBalanceMember, GroupBalancesResult } from "@/lib/group-balances";

interface GroupBalancesProps {
  balances: GroupBalancesResult;
}

export function GroupBalances({ balances }: GroupBalancesProps) {
  const { format } = useMoney();

  function balanceSentence(member: GroupBalanceMember): string {
    const amount = format(Math.abs(member.net));
    if (toPaisa(member.net) === 0) {
      return `${member.displayName} is settled`;
    }
    if (member.net > 0) {
      return owedAmountLine(member.displayName, amount);
    }
    return owesAmountLine(member.displayName, amount);
  }

  const allSettled = balances.members.every(
    (member) => toPaisa(member.net) === 0,
  );

  if (balances.members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e4e7ee] bg-[#fafbfd] px-4 py-4 text-center text-sm text-[#5a6072]">
        No members in this group.
      </div>
    );
  }

  if (allSettled) {
    const hasActivity = balances.members.some(
      (member) =>
        toPaisa(member.paidTotal) !== 0 || toPaisa(member.shareTotal) !== 0,
    );
    return (
      <div className="rounded-xl border border-dashed border-[#e4e7ee] bg-[#fafbfd] px-4 py-4 text-center text-sm text-[#5a6072]">
        {hasActivity
          ? "Everyone is settled."
          : "No expenses yet — everyone is settled."}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[#e4e7ee] overflow-hidden rounded-xl border border-[#e4e7ee] bg-white">
      {balances.members.map((member) => {
        const netZero = toPaisa(member.net) === 0;
        const owed = member.net > 0;
        const owes = member.net < 0;

        return (
          <li
            key={member.memberId}
            className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-semibold text-[#1a1d29]">
                {balanceSentence(member)}
              </p>
              <p className="mt-0.5 text-xs text-[#5a6072]">
                Paid {format(member.paidTotal)}
                {" · Share "}
                {format(member.shareTotal)}
                {member.memberType === "guest" ? " · guest" : ""}
              </p>
            </div>
            <p
              className={`shrink-0 text-sm font-bold ${
                netZero
                  ? "text-[#5a6072]"
                  : owed
                    ? "text-emerald-700"
                    : owes
                      ? "text-red-700"
                      : "text-[#5a6072]"
              }`}
              aria-label={balanceSentence(member)}
            >
              {netZero
                ? format(0)
                : `${owed ? "+" : "−"}${format(Math.abs(member.net))}`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export function GroupBalancesSkeleton() {
  return (
    <div className="space-y-0 overflow-hidden rounded-xl border border-[#e4e7ee] bg-white animate-pulse">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="border-b border-[#e4e7ee] px-4 py-3 last:border-0"
        >
          <div className="h-4 w-56 rounded bg-[#e4e7ee]" />
          <div className="mt-2 h-3 w-40 rounded bg-[#e4e7ee]" />
        </div>
      ))}
    </div>
  );
}
