import { Group } from "@/models/Group";
import { GroupExpense } from "@/models/GroupExpense";
import { GroupTransfer } from "@/models/GroupTransfer";
import {
  type ITransaction,
  type TransactionPublic,
  toTransactionPublic,
} from "@/models/Transaction";
import { roundAmount } from "@/lib/money";

/**
 * Adds optional deep links for ledger rows (e.g. group expenses → detail page).
 */
export async function toTransactionPublicWithLinks(
  transactions: ITransaction[],
): Promise<TransactionPublic[]> {
  const groupExpenseIds = transactions
    .filter((row) => row.sourceType === "group_expense")
    .map((row) => row.sourceId);

  const groupTransferIds = transactions
    .filter((row) => row.sourceType === "group_transfer")
    .map((row) => row.sourceId);

  const hrefBySourceId = new Map<string, string>();
  const groupExpenseById = new Map<
    string,
    TransactionPublic["groupExpense"]
  >();

  if (groupExpenseIds.length > 0) {
    const expenses = await GroupExpense.find({
      _id: { $in: groupExpenseIds },
    }).select("group amount payerMember participants");

    const groupIds = [
      ...new Set(expenses.map((expense) => expense.group.toString())),
    ];
    const groups =
      groupIds.length > 0
        ? await Group.find({ _id: { $in: groupIds } }).select("name")
        : [];
    const groupNames = new Map(
      groups.map((group) => [group._id.toString(), group.name]),
    );

    for (const expense of expenses) {
      const groupId = expense.group.toString();
      hrefBySourceId.set(
        expense._id.toString(),
        `/groups/${groupId}/expenses/${expense._id.toString()}`,
      );
      const ownShare =
        expense.participants.find((participant) =>
          participant.member.equals(expense.payerMember),
        )?.shareAmount ?? 0;
      groupExpenseById.set(expense._id.toString(), {
        yourShare: roundAmount(ownShare),
        othersShare: roundAmount(expense.amount - ownShare),
        groupId,
        groupName: groupNames.get(groupId) ?? "Group",
      });
    }
  }

  if (groupTransferIds.length > 0) {
    const transfers = await GroupTransfer.find({
      _id: { $in: groupTransferIds },
    }).select("group");

    for (const transfer of transfers) {
      hrefBySourceId.set(
        transfer._id.toString(),
        `/groups/${transfer.group.toString()}`,
      );
    }
  }

  return transactions.map((row) =>
    toTransactionPublic(row, {
      sourceHref:
        row.sourceType === "group_expense" ||
        row.sourceType === "group_transfer"
          ? (hrefBySourceId.get(row.sourceId.toString()) ?? null)
          : null,
      groupExpense:
        row.sourceType === "group_expense"
          ? groupExpenseById.get(row.sourceId.toString())
          : undefined,
    }),
  );
}
