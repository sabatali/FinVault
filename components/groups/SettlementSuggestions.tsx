"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import { useState } from "react";
import { useRouter } from "next/navigation";

import type { PendingBalanceTransfer } from "@/lib/group-balances";
import type { GroupMemberPublic } from "@/models/GroupMember";

export interface SettlementSuggestionItem {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  fromDisplayName: string;
  toDisplayName: string;
}

interface SettlementSuggestionsProps {
  groupId: string;
  currentMemberId: string;
  members: GroupMemberPublic[];
  currency?: string;
  initialSuggestions: SettlementSuggestionItem[];
  initialPending?: PendingBalanceTransfer[];
  onConfirmPending?: (transferId: string) => void;
  onRejectPending?: (transferId: string) => void;
  confirmingId?: string | null;
}

function canRecordSuggestion(input: {
  suggestion: SettlementSuggestionItem;
  currentMemberId: string;
  members: GroupMemberPublic[];
}): boolean {
  const from = input.members.find(
    (member) => member.id === input.suggestion.fromMemberId,
  );
  const to = input.members.find(
    (member) => member.id === input.suggestion.toMemberId,
  );

  // Debtor (sender) records registered→registered; anyone may log guest-side.
  if (from?.memberType === "guest" || to?.memberType === "guest") {
    return true;
  }

  return input.suggestion.fromMemberId === input.currentMemberId;
}

export function SettlementSuggestions({
  groupId,
  currentMemberId,
  members,
  initialSuggestions,
  initialPending = [],
  onConfirmPending,
  onRejectPending,
  confirmingId = null,
}: SettlementSuggestionsProps) {
  const { format } = useMoney();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [pending, setPending] = useState(initialPending);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/groups/${groupId}/settlement-suggestions`,
        { credentials: "include" },
      );
      const data = (await response.json()) as {
        suggestions?: SettlementSuggestionItem[];
        pending?: PendingBalanceTransfer[];
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Unable to load suggestions.");
        return;
      }
      setSuggestions(data.suggestions ?? []);
      setPending(data.pending ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function recordSuggestion(suggestion: SettlementSuggestionItem) {
    const params = new URLSearchParams({
      settleFrom: suggestion.fromMemberId,
      settleTo: suggestion.toMemberId,
      settleAmount: String(suggestion.amount),
    });
    router.push(`/groups/${groupId}?${params.toString()}#settlement-form`);
  }

  return (
    <div className="mt-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[#1a1d29]">
          Suggested settlements
        </h3>
        <p className="mt-1 text-xs text-[#5a6072]">
          A short list of payments that would clear everyone’s balances.
        </p>
      </div>

      {pending.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <h4 className="text-sm font-semibold text-amber-950">
            Waiting for confirmation
          </h4>
          <ul className="mt-2 space-y-2">
            {pending.map((row) => {
              const isReceiver = row.toMemberId === currentMemberId;
              return (
                <li
                  key={row.transferId}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm text-amber-950">
                    {row.fromDisplayName} → {row.toDisplayName}{" "}
                    {format(row.amount)} · waiting for {row.toDisplayName} to
                    confirm
                  </p>
                  {isReceiver ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={confirmingId === row.transferId}
                        onClick={() => onConfirmPending?.(row.transferId)}
                        className="rounded-lg bg-[#2f5fdc] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1e3fae] disabled:opacity-60"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        disabled={confirmingId === row.transferId}
                        onClick={() => onRejectPending?.(row.transferId)}
                        className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 text-sm font-semibold text-red-900 underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <SettlementSuggestionsSkeleton /> : null}

      {!loading && !error && suggestions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#e4e7ee] bg-[#fafbfd] px-4 py-6 text-center text-sm text-[#5a6072]">
          You&apos;re all settled up.
        </p>
      ) : null}

      {!loading && !error && suggestions.length > 0 ? (
        <ul className="divide-y divide-[#e4e7ee] overflow-hidden rounded-xl border border-[#e4e7ee] bg-white">
          {suggestions.map((suggestion) => {
            const sentence = `${suggestion.fromDisplayName} pays ${suggestion.toDisplayName} ${format(suggestion.amount)}`;
            const enabled = canRecordSuggestion({
              suggestion,
              currentMemberId,
              members,
            });

            return (
              <li
                key={`${suggestion.fromMemberId}-${suggestion.toMemberId}-${suggestion.amount}`}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm text-[#1a1d29]">{sentence}</p>
                <button
                  type="button"
                  disabled={!enabled}
                  title={
                    enabled
                      ? undefined
                      : "Only the payer can record this registered settlement."
                  }
                  onClick={() => recordSuggestion(suggestion)}
                  className="shrink-0 rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm font-medium text-[#2f5fdc] hover:bg-[#eef3ff] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Record settlement
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function SettlementSuggestionsSkeleton() {
  return (
    <div className="space-y-0 overflow-hidden rounded-xl border border-[#e4e7ee] bg-white animate-pulse">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="flex items-center justify-between border-b border-[#e4e7ee] px-4 py-3 last:border-0"
        >
          <div className="h-4 w-48 rounded bg-[#e4e7ee]" />
          <div className="h-8 w-32 rounded bg-[#e4e7ee]" />
        </div>
      ))}
    </div>
  );
}
