import { owedFromLine, owesToLine } from "@/lib/owes-labels";
import { roundAmount } from "@/lib/money";
import { toPaisa } from "@/lib/splits";
import type { GroupExpensePublic } from "@/models/GroupExpense";
import type {
  GroupTransferPublic,
  GroupTransferStatus,
} from "@/models/GroupTransfer";

export type GroupActivityKind = "expense" | "transfer";

export type GroupActivityTypeFilter = "all" | GroupActivityKind;

export type GroupActivityStatusFilter =
  | "all"
  | "pending"
  | "confirmed"
  | "rejected";

export interface GroupActivityExpenseEvent {
  kind: "expense";
  id: string;
  /** Chronological timestamp (expense occurredAt). */
  at: string;
  createdAt: string;
  expense: GroupExpensePublic;
}

export interface GroupActivityTransferEvent {
  kind: "transfer";
  id: string;
  /** Chronological timestamp (transfer createdAt). */
  at: string;
  createdAt: string;
  transfer: GroupTransferPublic;
}

export type GroupActivityEvent =
  | GroupActivityExpenseEvent
  | GroupActivityTransferEvent;

export interface GroupActivityFilters {
  from: string;
  to: string;
  memberId: string;
  type: GroupActivityTypeFilter;
  status: GroupActivityStatusFilter;
}

export const EMPTY_GROUP_ACTIVITY_FILTERS: GroupActivityFilters = {
  from: "",
  to: "",
  memberId: "",
  type: "all",
  status: "all",
};

export function buildExpenseActivityEvent(
  expense: GroupExpensePublic,
): GroupActivityExpenseEvent {
  return {
    kind: "expense",
    id: expense.id,
    at: expense.occurredAt,
    createdAt: expense.createdAt,
    expense,
  };
}

export function buildTransferActivityEvent(
  transfer: GroupTransferPublic,
): GroupActivityTransferEvent {
  return {
    kind: "transfer",
    id: transfer.id,
    at: transfer.createdAt,
    createdAt: transfer.createdAt,
    transfer,
  };
}

export function mergeGroupActivity(
  expenses: GroupExpensePublic[],
  transfers: GroupTransferPublic[],
): GroupActivityEvent[] {
  const events: GroupActivityEvent[] = [
    ...expenses.map(buildExpenseActivityEvent),
    ...transfers.map(buildTransferActivityEvent),
  ];
  return sortGroupActivityNewestFirst(events);
}

/** Newest first. Ties break on createdAt, then id. */
export function sortGroupActivityNewestFirst(
  events: GroupActivityEvent[],
): GroupActivityEvent[] {
  return [...events].sort((a, b) => {
    const byAt = timestampMs(b.at) - timestampMs(a.at);
    if (byAt !== 0) {
      return byAt;
    }
    const byCreated = timestampMs(b.createdAt) - timestampMs(a.createdAt);
    if (byCreated !== 0) {
      return byCreated;
    }
    return b.id.localeCompare(a.id);
  });
}

function timestampMs(iso: string): number {
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function involvedMemberIds(event: GroupActivityEvent): string[] {
  if (event.kind === "expense") {
    const ids = new Set<string>([event.expense.payerMemberId]);
    for (const participant of event.expense.participants) {
      ids.add(participant.memberId);
    }
    return [...ids];
  }
  return [event.transfer.fromMemberId, event.transfer.toMemberId];
}

/**
 * Signed delta from a member's perspective.
 * Expense: paid − share (owed to them is +, they owe is −).
 * Transfer: receiver +, sender − (pending/rejected included, not omitted).
 */
export function viewerSignedDelta(
  event: GroupActivityEvent,
  viewerMemberId: string,
): number {
  if (event.kind === "expense") {
    const paid =
      event.expense.payerMemberId === viewerMemberId
        ? event.expense.amount
        : 0;
    const share =
      event.expense.participants.find(
        (participant) => participant.memberId === viewerMemberId,
      )?.shareAmount ?? 0;
    return roundAmount(paid - share);
  }

  if (event.transfer.toMemberId === viewerMemberId) {
    return roundAmount(event.transfer.amount);
  }
  if (event.transfer.fromMemberId === viewerMemberId) {
    return roundAmount(-event.transfer.amount);
  }
  return 0;
}

export function transferStatusLabel(status: GroupTransferStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "rejected":
      return "Rejected";
    case "auto_confirmed":
      return "Auto-confirmed";
    default:
      return status;
  }
}

export function transferMatchesStatusFilter(
  status: GroupTransferStatus,
  filter: GroupActivityStatusFilter,
): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "confirmed") {
    return status === "confirmed" || status === "auto_confirmed";
  }
  return status === filter;
}

export function hasActiveGroupActivityFilters(
  filters: GroupActivityFilters,
): boolean {
  return (
    filters.from !== "" ||
    filters.to !== "" ||
    filters.memberId !== "" ||
    filters.type !== "all" ||
    filters.status !== "all"
  );
}

function matchesDateRange(iso: string, from: string, to: string): boolean {
  const time = timestampMs(iso);
  if (from) {
    const start = new Date(`${from}T00:00:00`).getTime();
    if (Number.isFinite(start) && time < start) {
      return false;
    }
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999`).getTime();
    if (Number.isFinite(end) && time > end) {
      return false;
    }
  }
  return true;
}

export function filterGroupActivity(
  events: GroupActivityEvent[],
  filters: GroupActivityFilters,
): GroupActivityEvent[] {
  return events.filter((event) => {
    if (filters.type !== "all" && event.kind !== filters.type) {
      return false;
    }
    if (filters.status !== "all") {
      if (event.kind !== "transfer") {
        return false;
      }
      if (!transferMatchesStatusFilter(event.transfer.status, filters.status)) {
        return false;
      }
    }
    if (
      filters.memberId &&
      !involvedMemberIds(event).includes(filters.memberId)
    ) {
      return false;
    }
    if (!matchesDateRange(event.at, filters.from, filters.to)) {
      return false;
    }
    return true;
  });
}

export function expenseOweLines(
  expense: GroupExpensePublic,
  formatAmount: (amount: number) => string,
): string[] {
  const payerName = expense.payerDisplayName ?? "Member";
  const lines: string[] = [];
  for (const participant of expense.participants) {
    if (participant.memberId === expense.payerMemberId) {
      continue;
    }
    if (toPaisa(participant.shareAmount) === 0) {
      continue;
    }
    const name = participant.displayName ?? "Member";
    lines.push(owesToLine(name, formatAmount(participant.shareAmount), payerName));
  }
  return lines;
}

export function transferHeadline(
  transfer: GroupTransferPublic,
  viewerMemberId: string,
  formatAmount: (amount: number) => string,
): string {
  const fromName = transfer.fromDisplayName ?? "Member";
  const toName = transfer.toDisplayName ?? "Member";
  const amount = formatAmount(transfer.amount);
  if (transfer.toMemberId === viewerMemberId) {
    return owedFromLine(toName, amount, fromName);
  }
  return owesToLine(fromName, amount, toName);
}

export function splitTypeLabel(splitType: GroupExpensePublic["splitType"]): string {
  return splitType === "equal" ? "Equal split" : "Manual split";
}
