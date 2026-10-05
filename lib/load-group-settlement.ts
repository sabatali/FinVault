import { connectDB } from "@/lib/db";
import type {
  BalanceMemberInput,
} from "@/lib/group-balances";
import type { PairwiseExpenseInput, PairwiseTransferInput } from "@/lib/group-pairwise";
import type { StatementExpenseInput, StatementTransferInput } from "@/lib/group-statement";
import { GroupExpense } from "@/models/GroupExpense";
import { GroupMember } from "@/models/GroupMember";
import { GroupTransfer } from "@/models/GroupTransfer";

export interface GroupSettlementData {
  members: BalanceMemberInput[];
  expenses: Array<StatementExpenseInput & PairwiseExpenseInput>;
  transfers: Array<StatementTransferInput & PairwiseTransferInput>;
}

export async function loadGroupSettlementData(
  groupId: string,
): Promise<GroupSettlementData> {
  await connectDB();

  const [members, expenses, transfers] = await Promise.all([
    GroupMember.find({ group: groupId }).sort({ displayName: 1 }),
    GroupExpense.find({ group: groupId }).select(
      "payerMember amount participants description occurredAt createdAt",
    ),
    GroupTransfer.find({ group: groupId }).select(
      "fromMember toMember amount status createdAt resolvedAt",
    ),
  ]);

  return {
    members: members.map((member) => ({
      memberId: member._id.toString(),
      displayName: member.displayName,
      memberType: member.memberType,
    })),
    expenses: expenses.map((expense) => ({
      expenseId: expense._id.toString(),
      description: expense.description,
      occurredAt: expense.occurredAt.toISOString(),
      createdAt: expense.createdAt.toISOString(),
      payerMemberId: expense.payerMember.toString(),
      amount: expense.amount,
      participants: expense.participants.map((participant) => ({
        memberId: participant.member.toString(),
        shareAmount: participant.shareAmount,
      })),
    })),
    transfers: transfers.map((transfer) => {
      const occurredAt = (
        transfer.resolvedAt ?? transfer.createdAt
      ).toISOString();
      return {
        transferId: transfer._id.toString(),
        fromMemberId: transfer.fromMember.toString(),
        toMemberId: transfer.toMember.toString(),
        amount: transfer.amount,
        status: transfer.status,
        occurredAt,
        createdAt: transfer.createdAt.toISOString(),
      };
    }),
  };
}
