"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { GroupBalances } from "@/components/groups/GroupBalances";
import { MyGroupPosition } from "@/components/groups/MyGroupPosition";
import {
  SettlementExplanation,
  type SettlementExplanationTarget,
} from "@/components/groups/SettlementExplanation";
import { SettlementSuggestions } from "@/components/groups/SettlementSuggestions";
import type {
  GroupBalanceMember,
  GroupBalancesResult,
  PendingBalanceTransfer,
} from "@/lib/group-balances";
import type { PairwiseDebt } from "@/lib/group-pairwise";
import type { NamedSuggestion } from "@/lib/settlement-view";
import type { GroupMemberPublic } from "@/models/GroupMember";

interface GroupSettlementPanelProps {
  groupId: string;
  currentMemberId: string;
  balances: GroupBalancesResult;
  members: GroupMemberPublic[];
  suggestions: NamedSuggestion[];
  pairwise: PairwiseDebt[];
  pending: PendingBalanceTransfer[];
}

export function GroupSettlementPanel({
  groupId,
  currentMemberId,
  balances,
  members,
  suggestions,
  pairwise,
  pending,
}: GroupSettlementPanelProps) {
  const router = useRouter();
  const [why, setWhy] = useState<SettlementExplanationTarget | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmPending(transferId: string) {
    setConfirmingId(transferId);
    setError(null);
    try {
      const response = await fetch(
        `/api/groups/${groupId}/transfers/${transferId}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to confirm.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setConfirmingId(null);
    }
  }

  async function rejectPending(transferId: string) {
    setConfirmingId(transferId);
    setError(null);
    try {
      const response = await fetch(
        `/api/groups/${groupId}/transfers/${transferId}/reject`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to reject.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <MyGroupPosition
        groupId={groupId}
        currentMemberId={currentMemberId}
        members={balances.members}
        suggestions={suggestions}
        pairwise={pairwise}
        pending={pending}
        onWhy={setWhy}
        onConfirmPending={(transferId) => void confirmPending(transferId)}
        confirmingId={confirmingId}
      />

      <GroupBalances balances={balances} groupId={groupId} />

      <SettlementSuggestions
        key={suggestions
          .map(
            (row) => `${row.fromMemberId}:${row.toMemberId}:${row.amount}`,
          )
          .join("|")}
        groupId={groupId}
        currentMemberId={currentMemberId}
        members={members}
        currency={balances.currency}
        initialSuggestions={suggestions}
        initialPending={pending}
        onConfirmPending={(transferId) => void confirmPending(transferId)}
        onRejectPending={(transferId) => void rejectPending(transferId)}
        confirmingId={confirmingId}
      />

      <SettlementExplanation
        open={Boolean(why)}
        target={why}
        members={balances.members as GroupBalanceMember[]}
        suggestions={suggestions}
        pairwise={pairwise}
        onClose={() => setWhy(null)}
      />
    </div>
  );
}
