import type { TransactionSourceType } from "@/models/Transaction";

export const SOURCE_TYPE_LABELS: Record<TransactionSourceType, string> = {
  opening_balance: "Opening balance",
  expense: "Personal expense",
  income: "Personal income",
  group_expense: "Group expense",
  group_transfer: "Group settlement",
  adjustment: "Adjustment",
};

export function getSourceTypeLabel(sourceType: string): string {
  if (sourceType in SOURCE_TYPE_LABELS) {
    return SOURCE_TYPE_LABELS[sourceType as TransactionSourceType];
  }
  return sourceType.replace(/_/g, " ");
}
