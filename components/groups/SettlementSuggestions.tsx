"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
  currency = "PKR",
  initialSuggestions,
}: SettlementSuggestionsProps) {
  const { format } = useMoney();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState(initialSuggestions);
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
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Unable to load suggestions.");
        return;
      }
      setSuggestions(data.suggestions ?? []);
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
