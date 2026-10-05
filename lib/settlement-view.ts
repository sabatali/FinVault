import type {
  GroupBalanceMember,
  PendingBalanceTransfer,
} from "@/lib/group-balances";
import type { PairwiseDebt } from "@/lib/group-pairwise";
import type { SettleSuggestion } from "@/lib/settle";
import { suggestTransfers } from "@/lib/settle";

export interface NamedSuggestion {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  fromDisplayName: string;
  toDisplayName: string;
}

export function suggestionsFromBalances(
  members: GroupBalanceMember[],
): NamedSuggestion[] {
  const nameById = new Map(
    members.map((member) => [member.memberId, member.displayName]),
  );
  return suggestTransfers(
    members.map((member) => ({
      memberId: member.memberId,
      net: member.netAfterPending,
    })),
  ).map((row) => ({
    ...row,
    fromDisplayName: nameById.get(row.fromMemberId) ?? "Member",
    toDisplayName: nameById.get(row.toMemberId) ?? "Member",
  }));
}

export function pairwiseRowsForMember(
  memberId: string,
  debts: PairwiseDebt[],
  nameById: Map<string, string>,
): NamedSuggestion[] {
  return debts
    .filter(
      (debt) =>
        (debt.debtorMemberId === memberId ||
          debt.creditorMemberId === memberId) &&
        debt.remaining > 0,
    )
    .map((debt) => ({
      fromMemberId: debt.debtorMemberId,
      toMemberId: debt.creditorMemberId,
      amount: debt.remaining,
      fromDisplayName: nameById.get(debt.debtorMemberId) ?? "Member",
      toDisplayName: nameById.get(debt.creditorMemberId) ?? "Member",
    }));
}

export function pendingForMember(
  memberId: string,
  pending: PendingBalanceTransfer[],
): PendingBalanceTransfer[] {
  return pending.filter(
    (row) => row.fromMemberId === memberId || row.toMemberId === memberId,
  );
}

export function findSuggestion(
  suggestions: SettleSuggestion[],
  fromMemberId: string,
  toMemberId: string,
): SettleSuggestion | undefined {
  return suggestions.find(
    (row) =>
      row.fromMemberId === fromMemberId && row.toMemberId === toMemberId,
  );
}
