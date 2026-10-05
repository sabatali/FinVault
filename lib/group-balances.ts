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
  pendingIn: number;
  pendingOut: number;
  netAfterPending: number;
}

export interface PendingBalanceTransfer {
  transferId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  fromDisplayName: string;
  toDisplayName: string;
  createdAt: string;
}

export interface GroupBalancesResult {
  currency: string;
  members: GroupBalanceMember[];
  sumOfNets: number;
  pendingTransfers: PendingBalanceTransfer[];
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
  pendingTransfers?: BalanceTransferInput[];
  currency?: string;
}): GroupBalancesResult {
  const paid = new Map<string, number>();
  const share = new Map<string, number>();
  const transferAdj = new Map<string, number>();
  const pendingIn = new Map<string, number>();
  const pendingOut = new Map<string, number>();

  for (const member of input.members) {
    paid.set(member.memberId, 0);
    share.set(member.memberId, 0);
    transferAdj.set(member.memberId, 0);
    pendingIn.set(member.memberId, 0);
    pendingOut.set(member.memberId, 0);
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

  for (const transfer of input.pendingTransfers ?? []) {
    const amountPaisa = toPaisa(transfer.amount);
    pendingOut.set(
      transfer.fromMemberId,
      (pendingOut.get(transfer.fromMemberId) ?? 0) + amountPaisa,
    );
    pendingIn.set(
      transfer.toMemberId,
      (pendingIn.get(transfer.toMemberId) ?? 0) + amountPaisa,
    );
  }

  const members: GroupBalanceMember[] = input.members.map((member) => {
    const paidTotal = paid.get(member.memberId) ?? 0;
    const shareTotal = share.get(member.memberId) ?? 0;
    const adj = transferAdj.get(member.memberId) ?? 0;
    const net = roundAmount(paidTotal - shareTotal + adj);
    const pendingInAmount = fromPaisa(pendingIn.get(member.memberId) ?? 0);
    const pendingOutAmount = fromPaisa(pendingOut.get(member.memberId) ?? 0);
    const netAfterPending = fromPaisa(
      toPaisa(net) + toPaisa(pendingOutAmount) - toPaisa(pendingInAmount),
    );
    return {
      memberId: member.memberId,
      displayName: member.displayName,
      memberType: member.memberType,
      net,
      paidTotal,
      shareTotal,
      pendingIn: pendingInAmount,
      pendingOut: pendingOutAmount,
      netAfterPending,
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
    pendingTransfers: [],
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
      status: { $in: [...CONFIRMED_TRANSFER_STATUSES, "pending"] },
    }).select("fromMember toMember amount status createdAt"),
  ]);

  const nameById = new Map(
    members.map((member) => [member._id.toString(), member.displayName]),
  );

  const confirmed = transfers.filter((transfer) =>
    CONFIRMED_TRANSFER_STATUSES.includes(transfer.status),
  );
  const pending = transfers.filter((transfer) => transfer.status === "pending");

  const result = aggregateGroupBalances({
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
    transfers: confirmed.map((transfer) => ({
      fromMemberId: transfer.fromMember.toString(),
      toMemberId: transfer.toMember.toString(),
      amount: transfer.amount,
    })),
    pendingTransfers: pending.map((transfer) => ({
      fromMemberId: transfer.fromMember.toString(),
      toMemberId: transfer.toMember.toString(),
      amount: transfer.amount,
    })),
    currency: "PKR",
  });

  result.pendingTransfers = pending.map((transfer) => {
    const fromMemberId = transfer.fromMember.toString();
    const toMemberId = transfer.toMember.toString();
    return {
      transferId: transfer._id.toString(),
      fromMemberId,
      toMemberId,
      amount: transfer.amount,
      fromDisplayName: nameById.get(fromMemberId) ?? "Member",
      toDisplayName: nameById.get(toMemberId) ?? "Member",
      createdAt: transfer.createdAt.toISOString(),
    };
  });

  return result;
}
