import { connectDB } from "@/lib/db";
import { listMembersForGroup } from "@/lib/group-access";
import { mergeGroupActivity } from "@/lib/group-activity";
import { Account } from "@/models/Account";
import {
  GroupExpense,
  toGroupExpensePublic,
  type GroupExpensePublic,
} from "@/models/GroupExpense";
import { GroupMember, toGroupMemberPublic } from "@/models/GroupMember";
import {
  GroupTransfer,
  toGroupTransferPublic,
  type GroupTransferPublic,
} from "@/models/GroupTransfer";

export async function loadGroupActivity(groupId: string): Promise<{
  events: ReturnType<typeof mergeGroupActivity>;
  members: ReturnType<typeof toGroupMemberPublic>[];
}> {
  await connectDB();

  const [members, expenses, transfers] = await Promise.all([
    listMembersForGroup(groupId),
    GroupExpense.find({ group: groupId }),
    GroupTransfer.find({ group: groupId }),
  ]);

  const memberIds = new Set<string>(
    members.map((member) => member._id.toString()),
  );
  for (const expense of expenses) {
    memberIds.add(expense.payerMember.toString());
    for (const participant of expense.participants) {
      memberIds.add(participant.member.toString());
    }
  }
  for (const transfer of transfers) {
    memberIds.add(transfer.fromMember.toString());
    memberIds.add(transfer.toMember.toString());
  }

  const namedMembers = await GroupMember.find({
    _id: { $in: [...memberIds] },
  }).select("displayName");
  const nameMap = Object.fromEntries(
    namedMembers.map((member) => [member._id.toString(), member.displayName]),
  );

  const accountIds = new Set<string>();
  for (const expense of expenses) {
    if (expense.payerAccount) {
      accountIds.add(expense.payerAccount.toString());
    }
  }
  for (const transfer of transfers) {
    if (transfer.fromAccount) {
      accountIds.add(transfer.fromAccount.toString());
    }
    if (transfer.toAccount) {
      accountIds.add(transfer.toAccount.toString());
    }
  }

  const accounts =
    accountIds.size > 0
      ? await Account.find({ _id: { $in: [...accountIds] } }).select("name")
      : [];
  const accountNames = new Map(
    accounts.map((account) => [account._id.toString(), account.name]),
  );

  const publicExpenses: GroupExpensePublic[] = expenses.map((expense) =>
    toGroupExpensePublic(expense, {
      payerDisplayName: nameMap[expense.payerMember.toString()],
      payerAccountName: expense.payerAccount
        ? accountNames.get(expense.payerAccount.toString())
        : undefined,
      participantNames: nameMap,
    }),
  );

  const publicTransfers: GroupTransferPublic[] = transfers.map((transfer) =>
    toGroupTransferPublic(transfer, {
      fromDisplayName: nameMap[transfer.fromMember.toString()],
      toDisplayName: nameMap[transfer.toMember.toString()],
      fromAccountName: transfer.fromAccount
        ? accountNames.get(transfer.fromAccount.toString())
        : undefined,
      toAccountName: transfer.toAccount
        ? accountNames.get(transfer.toAccount.toString())
        : undefined,
    }),
  );

  return {
    events: mergeGroupActivity(publicExpenses, publicTransfers),
    members: members.map(toGroupMemberPublic),
  };
}
