import { connectDB } from "@/lib/db";
import { fromPaisa, toPaisa } from "@/lib/splits";
import { roundAmount } from "@/lib/money";
import { GroupExpense } from "@/models/GroupExpense";
import {
  GroupMember,
  type GroupMemberType,
} from "@/models/GroupMember";
import {
  CONFIRMED_TRANSFER_STATUSES,
  GroupTransfer,
} from "@/models/GroupTransfer";

export interface GroupBalanceMember {
  memberId: string;
  displayName: string;
  memberType: GroupMemberType;
  net: number;
  paidTotal: number;
  shareTotal: number;
}

export interface GroupBalancesResult {
  currency: string;
  members: GroupBalanceMember[];
  sumOfNets: number;
}

export interface BalanceExpenseInput {
  payerMemberId: string;
  amount: number;
  participants: Array<{ memberId: string; shareAmount: number }>;
}

export interface BalanceTransferInput {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

export interface BalanceMemberInput {
  memberId: string;
  displayName: string;
  memberType: GroupMemberType;
}

/**
 * Pure balance aggregation for tests and computeGroupBalances.
 * net = paidTotal − shareTotal + transferAdjustments
 * where a confirmed transfer of X from A→B means A.net += X, B.net -= X.
 */
export function aggregateGroupBalances(input: {
  members: BalanceMemberInput[];
  expenses: BalanceExpenseInput[];
  transfers?: BalanceTransferInput[];
  currency?: string;
}): GroupBalancesResult {
  const paid = new Map<string, number>();
  const share = new Map<string, number>();
  const transferAdj = new Map<string, number>();

  for (const member of input.members) {
    paid.set(member.memberId, 0);
    share.set(member.memberId, 0);
    transferAdj.set(member.memberId, 0);
  }

  for (const expense of input.expenses) {
    const amount = roundAmount(expense.amount);
    paid.set(
      expense.payerMemberId,
      roundAmount((paid.get(expense.payerMemberId) ?? 0) + amount),
    );
    for (const participant of expense.participants) {
      share.set(
        participant.memberId,
        roundAmount(
          (share.get(participant.memberId) ?? 0) +
            roundAmount(participant.shareAmount),
        ),
      );
    }
  }

  for (const transfer of input.transfers ?? []) {
    const amount = roundAmount(transfer.amount);
    transferAdj.set(
      transfer.fromMemberId,
      roundAmount((transferAdj.get(transfer.fromMemberId) ?? 0) + amount),
    );
    transferAdj.set(
      transfer.toMemberId,
      roundAmount((transferAdj.get(transfer.toMemberId) ?? 0) - amount),
    );
  }

  const members: GroupBalanceMember[] = input.members.map((member) => {
    const paidTotal = paid.get(member.memberId) ?? 0;
    const shareTotal = share.get(member.memberId) ?? 0;
    const adj = transferAdj.get(member.memberId) ?? 0;
    const net = roundAmount(paidTotal - shareTotal + adj);
    return {
      memberId: member.memberId,
      displayName: member.displayName,
      memberType: member.memberType,
      net,
      paidTotal,
      shareTotal,
    };
  });

  members.sort((a, b) => {
    if (b.net !== a.net) {
      return b.net - a.net;
    }
    return a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: "base",
    });
  });

  const sumPaisa = members.reduce((sum, row) => sum + toPaisa(row.net), 0);
  const sumOfNets = fromPaisa(sumPaisa);

  return {
    currency: input.currency ?? "PKR",
    members,
    sumOfNets,
  };
}

export async function computeGroupBalances(
  groupId: string,
): Promise<GroupBalancesResult> {
  await connectDB();

  const [members, expenses, transfers] = await Promise.all([
    GroupMember.find({ group: groupId }).sort({ displayName: 1 }),
    GroupExpense.find({ group: groupId }).select(
      "payerMember amount participants",
    ),
    GroupTransfer.find({
      group: groupId,
      status: { $in: CONFIRMED_TRANSFER_STATUSES },
    }).select("fromMember toMember amount"),
  ]);

  return aggregateGroupBalances({
    members: members.map((member) => ({
      memberId: member._id.toString(),
      displayName: member.displayName,
      memberType: member.memberType,
    })),
    expenses: expenses.map((expense) => ({
      payerMemberId: expense.payerMember.toString(),
      amount: expense.amount,
      participants: expense.participants.map((participant) => ({
        memberId: participant.member.toString(),
        shareAmount: participant.shareAmount,
      })),
    })),
    transfers: transfers.map((transfer) => ({
      fromMemberId: transfer.fromMember.toString(),
      toMemberId: transfer.toMember.toString(),
      amount: transfer.amount,
    })),
    currency: "PKR",
  });
}
