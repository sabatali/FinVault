"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { GroupBalanceMember, PendingBalanceTransfer } from "@/lib/group-balances";
import {
  DIRECT_LABEL,
  FEWEST_PAYMENTS_LABEL,
  FEWEST_VS_DIRECT_HELP,
  SETTLED_UP,
  YOU_GET_EN_UR,
  YOU_OWE_EN_UR,
} from "@/lib/owes-labels";
import type { PairwiseDebt } from "@/lib/group-pairwise";
import {
  pairwiseRowsForMember,
  type NamedSuggestion,
} from "@/lib/settlement-view";
import { toPaisa } from "@/lib/splits";

interface MyGroupPositionProps {
  groupId: string;
  currentMemberId: string;
  members: GroupBalanceMember[];
  suggestions: NamedSuggestion[];
  pairwise: PairwiseDebt[];
  pending: PendingBalanceTransfer[];
  onWhy: (row: NamedSuggestion) => void;
  onConfirmPending: (transferId: string) => void;
  confirmingId: string | null;
}

export function MyGroupPosition({
  groupId,
  currentMemberId,
  members,
  suggestions,
  pairwise,
  pending,
  onWhy,
  onConfirmPending,
  confirmingId,
}: MyGroupPositionProps) {
  const { format } = useMoney();
  const router = useRouter();
  const [mode, setMode] = useState<"fewest" | "direct">("fewest");

  const me = members.find((member) => member.memberId === currentMemberId);
  const nameById = useMemo(
    () => new Map(members.map((member) => [member.memberId, member.displayName])),
    [members],
  );

  const rows = useMemo(() => {
    if (mode === "direct") {
      return pairwiseRowsForMember(currentMemberId, pairwise, nameById);
    }
    return suggestions.filter(
      (row) =>
        row.fromMemberId === currentMemberId ||
        row.toMemberId === currentMemberId,
    );
  }, [mode, suggestions, pairwise, currentMemberId, nameById]);

  const myPending = pending.filter(
    (row) =>
      row.fromMemberId === currentMemberId ||
      row.toMemberId === currentMemberId,
  );

  if (!me) {
    return null;
  }

  const net = me.net;
  const headline =
    toPaisa(net) === 0
      ? SETTLED_UP
      : net > 0
        ? `${YOU_GET_EN_UR} ${format(net)}`
        : `${YOU_OWE_EN_UR} ${format(Math.abs(net))}`;

  function payNow(row: NamedSuggestion) {
    const params = new URLSearchParams({
      tab: "settlements",
      settleFrom: row.fromMemberId,
      settleTo: row.toMemberId,
      settleAmount: String(row.amount),
    });
    router.push(`/groups/${groupId}?${params.toString()}#settlement-form`);
  }

  return (
    <section className="rounded-xl border border-[#e4e7ee] bg-white p-4 sm:p-5">
      <p
        className={`text-xl font-extrabold tracking-tight ${
          toPaisa(net) === 0
            ? "text-[#1a1d29]"
            : net > 0
              ? "text-emerald-700"
              : "text-red-700"
        }`}
      >
        {headline}
      </p>

      <div className="mt-4 flex rounded-lg border border-[#e4e7ee] p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("fewest")}
          className={`flex-1 rounded-md px-3 py-1.5 font-semibold ${
            mode === "fewest"
              ? "bg-[#eef3ff] text-[#2f5fdc]"
              : "text-[#5a6072]"
          }`}
        >
          {FEWEST_PAYMENTS_LABEL}
        </button>
        <button
          type="button"
          onClick={() => setMode("direct")}
          className={`flex-1 rounded-md px-3 py-1.5 font-semibold ${
            mode === "direct"
              ? "bg-[#eef3ff] text-[#2f5fdc]"
              : "text-[#5a6072]"
          }`}
        >
          {DIRECT_LABEL}
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#5a6072]">
        {FEWEST_VS_DIRECT_HELP}
      </p>

      {rows.length === 0 && myPending.length === 0 ? (
        <p className="mt-4 text-sm text-[#5a6072]">
          No payments left for you in this view.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[#e4e7ee] overflow-hidden rounded-lg border border-[#e4e7ee]">
          {rows.map((row) => {
            const youPay = row.fromMemberId === currentMemberId;
            return (
              <li
                key={`${mode}-${row.fromMemberId}-${row.toMemberId}-${row.amount}`}
                className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm text-[#1a1d29]">
                  {youPay ? (
                    <>
                      Pay <strong>{row.toDisplayName}</strong> {format(row.amount)}
                    </>
                  ) : (
                    <>
                      <strong>{row.fromDisplayName}</strong> pays you{" "}
                      {format(row.amount)}
                    </>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onWhy(row)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#2f5fdc] hover:bg-[#eef3ff]"
                  >
                    Why?
                  </button>
                  {youPay ? (
                    <button
                      type="button"
                      onClick={() => payNow(row)}
                      className="rounded-lg bg-[#2f5fdc] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1e3fae]"
                    >
                      Pay now
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
          {myPending.map((row) => {
            const youSent = row.fromMemberId === currentMemberId;
            return (
              <li
                key={row.transferId}
                className="flex flex-col gap-2 bg-[#fafbfd] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm text-[#5a6072]">
                  {youSent
                    ? `${format(row.amount)} sent to ${row.toDisplayName} — waiting for ${row.toDisplayName} to confirm`
                    : `${row.fromDisplayName} sent you ${format(row.amount)}`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onWhy({
                        fromMemberId: row.fromMemberId,
                        toMemberId: row.toMemberId,
                        amount: row.amount,
                        fromDisplayName: row.fromDisplayName,
                        toDisplayName: row.toDisplayName,
                      })
                    }
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#2f5fdc] hover:bg-[#eef3ff]"
                  >
                    Why?
                  </button>
                  {!youSent ? (
                    <button
                      type="button"
                      disabled={confirmingId === row.transferId}
                      onClick={() => onConfirmPending(row.transferId)}
                      className="rounded-lg bg-[#2f5fdc] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1e3fae] disabled:opacity-60"
                    >
                      {confirmingId === row.transferId ? "Confirming…" : "Confirm"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4">
        <Link
          href={`/groups/${groupId}/statement?member=${currentMemberId}`}
          className="text-sm font-semibold text-[#2f5fdc] hover:underline"
        >
          View statement
        </Link>
      </p>
    </section>
  );
}
