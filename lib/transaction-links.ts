import { GroupExpense } from "@/models/GroupExpense";
import { GroupTransfer } from "@/models/GroupTransfer";
import {
  type ITransaction,
  type TransactionPublic,
  toTransactionPublic,
} from "@/models/Transaction";

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

  if (groupExpenseIds.length > 0) {
    const expenses = await GroupExpense.find({
      _id: { $in: groupExpenseIds },
    }).select("group");

    for (const expense of expenses) {
      hrefBySourceId.set(
        expense._id.toString(),
        `/groups/${expense.group.toString()}/expenses/${expense._id.toString()}`,
      );
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
    }),
  );
}
