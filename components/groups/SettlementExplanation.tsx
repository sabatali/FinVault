"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import { useEffect, useRef } from "react";

import type { GroupBalanceMember } from "@/lib/group-balances";
import type { PairwiseDebt } from "@/lib/group-pairwise";
import type { NamedSuggestion } from "@/lib/settlement-view";
import { toPaisa } from "@/lib/splits";

export interface SettlementExplanationTarget {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  fromDisplayName: string;
  toDisplayName: string;
}

interface SettlementExplanationProps {
  open: boolean;
  target: SettlementExplanationTarget | null;
  members: GroupBalanceMember[];
  suggestions: NamedSuggestion[];
  pairwise: PairwiseDebt[];
  onClose: () => void;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function SettlementExplanation({
  open,
  target,
  members,
  suggestions,
  pairwise,
  onClose,
}: SettlementExplanationProps) {
  const { format } = useMoney();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !target) {
    return null;
  }

  const from = members.find((member) => member.memberId === target.fromMemberId);
  const to = members.find((member) => member.memberId === target.toMemberId);
  const pair = pairwise.find(
    (debt) =>
      (debt.debtorMemberId === target.fromMemberId &&
        debt.creditorMemberId === target.toMemberId) ||
      (debt.debtorMemberId === target.toMemberId &&
        debt.creditorMemberId === target.fromMemberId),
  );
  const otherPayments = suggestions.filter(
    (row) =>
      row.fromMemberId === target.fromMemberId &&
      row.toMemberId !== target.toMemberId,
  );
  const hasDirectHistory = Boolean(
    pair &&
      (pair.expenses.length > 0 ||
        pair.offsetExpenses.length > 0 ||
        pair.settlements.length > 0),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end">
      <button
        type="button"
        aria-label="Close explanation"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settlement-why-title"
        className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border border-[#e4e7ee] bg-white p-5 shadow-lg sm:h-full sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="settlement-why-title"
              className="text-lg font-bold text-[#1a1d29]"
            >
              Why this payment
            </h2>
            <p className="mt-1 text-sm text-[#5a6072]">
              {target.fromDisplayName} pays {target.toDisplayName}{" "}
              {format(target.amount)}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#5a6072] hover:bg-[#f4f6fb]"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-3 text-sm text-[#1a1d29]">
          {from ? (
            <p>
              {from.displayName} paid {format(from.paidTotal)},{" "}
              {from.displayName}&apos;s share was {format(from.shareTotal)} →{" "}
              {toPaisa(from.net) < 0
                ? `${from.displayName} owes the group ${format(Math.abs(from.net))}`
                : toPaisa(from.net) > 0
                  ? `the group owes ${from.displayName} ${format(from.net)}`
                  : `${from.displayName} is settled`}
            </p>
          ) : null}
          {to ? (
            <p>
              {to.displayName} paid {format(to.paidTotal)}, {to.displayName}
              &apos;s share was {format(to.shareTotal)} →{" "}
              {toPaisa(to.net) > 0
                ? `the group owes ${to.displayName} ${format(to.net)}`
                : toPaisa(to.net) < 0
                  ? `${to.displayName} owes the group ${format(Math.abs(to.net))}`
                  : `${to.displayName} is settled`}
            </p>
          ) : null}
          <p>
            The app matched {target.fromDisplayName} to {target.toDisplayName}{" "}
            for {format(target.amount)}.
            {otherPayments.length > 0
              ? ` ${target.fromDisplayName}'s other payments: ${otherPayments
                  .map(
                    (row) => `${row.toDisplayName} ${format(row.amount)}`,
                  )
                  .join(", ")}.`
              : ""}
          </p>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[#1a1d29]">
            Direct history
          </h3>
          {!hasDirectHistory ? (
            <p className="mt-2 text-sm text-[#5a6072]">
              {target.fromDisplayName} and {target.toDisplayName} have no
              direct bills — this payment comes from combining balances.
            </p>
          ) : (
            <div className="mt-2 overflow-hidden rounded-xl border border-[#e4e7ee]">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#f4f6fb] text-[#5a6072]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4e7ee]">
                  {pair?.expenses.map((item) => (
                    <tr key={`e-${item.expenseId}`}>
                      <td className="px-3 py-2 text-[#5a6072]">
                        {formatDate(item.occurredAt)}
                      </td>
                      <td className="px-3 py-2 text-[#1a1d29]">
                        {item.description} · {target.fromDisplayName} share
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-[#1a1d29]">
                        {format(item.amount)}
                      </td>
                    </tr>
                  ))}
                  {pair?.offsetExpenses.map((item) => (
                    <tr key={`o-${item.expenseId}`}>
                      <td className="px-3 py-2 text-[#5a6072]">
                        {formatDate(item.occurredAt)}
                      </td>
                      <td className="px-3 py-2 text-[#1a1d29]">
                        {item.description} · {target.toDisplayName} share
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-[#1a1d29]">
                        {format(item.amount)}
                      </td>
                    </tr>
                  ))}
                  {pair?.settlements.map((item) => (
                    <tr key={`s-${item.transferId}`}>
                      <td className="px-3 py-2 text-[#5a6072]">
                        {formatDate(item.occurredAt)}
                      </td>
                      <td className="px-3 py-2 text-[#1a1d29]">
                        Settlement · {item.status}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-[#1a1d29]">
                        {format(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pair ? (
                <p className="border-t border-[#e4e7ee] px-3 py-2 text-sm font-semibold text-[#1a1d29]">
                  Direct net {format(pair.remaining)}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
