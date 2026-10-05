import type {
  BalanceExpenseInput,
  BalanceMemberInput,
  BalanceTransferInput,
} from "@/lib/group-balances";
import { fromPaisa, toPaisa } from "@/lib/splits";
import type { GroupTransferStatus } from "@/models/GroupTransfer";

export interface PairwiseExpenseItem {
  expenseId: string;
  description: string;
  occurredAt: string;
  amount: number;
}

export interface PairwiseSettlementItem {
  transferId: string;
  status: "confirmed" | "auto_confirmed" | "pending";
  occurredAt: string;
  amount: number;
}

export interface PairwiseDebt {
  debtorMemberId: string;
  creditorMemberId: string;
  grossOwed: number;
  grossOwedBack: number;
  settled: number;
  pending: number;
  remaining: number;
  expenses: PairwiseExpenseItem[];
  offsetExpenses: PairwiseExpenseItem[];
  settlements: PairwiseSettlementItem[];
}

export type PairwiseExpenseInput = BalanceExpenseInput & {
  expenseId: string;
  description: string;
  occurredAt: string;
};

export type PairwiseTransferInput = BalanceTransferInput & {
  transferId: string;
  status: GroupTransferStatus;
  occurredAt: string;
};

interface PairBucket {
  low: string;
  high: string;
  owedLowToHigh: number;
  owedHighToLow: number;
  settledLowToHigh: number;
  pendingLowToHigh: number;
  pendingHighToLow: number;
  expensesLowToHigh: PairwiseExpenseItem[];
  expensesHighToLow: PairwiseExpenseItem[];
  settlements: PairwiseSettlementItem[];
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function isCountedStatus(
  status: GroupTransferStatus,
): status is PairwiseSettlementItem["status"] {
  return (
    status === "confirmed" ||
    status === "auto_confirmed" ||
    status === "pending"
  );
}

export function computePairwiseDebts(input: {
  members: BalanceMemberInput[];
  expenses: PairwiseExpenseInput[];
  transfers: PairwiseTransferInput[];
}): PairwiseDebt[] {
  const memberIds = new Set(input.members.map((member) => member.memberId));
  const buckets = new Map<string, PairBucket>();

  function bucketFor(a: string, b: string): PairBucket {
    const key = pairKey(a, b);
    const existing = buckets.get(key);
    if (existing) {
      return existing;
    }
    const low = a < b ? a : b;
    const high = a < b ? b : a;
    const created: PairBucket = {
      low,
      high,
      owedLowToHigh: 0,
      owedHighToLow: 0,
      settledLowToHigh: 0,
      pendingLowToHigh: 0,
      pendingHighToLow: 0,
      expensesLowToHigh: [],
      expensesHighToLow: [],
      settlements: [],
    };
    buckets.set(key, created);
    return created;
  }

  for (const expense of input.expenses) {
    if (!memberIds.has(expense.payerMemberId)) {
      continue;
    }
    for (const participant of expense.participants) {
      if (
        participant.memberId === expense.payerMemberId ||
        !memberIds.has(participant.memberId)
      ) {
        continue;
      }
      const sharePaisa = toPaisa(participant.shareAmount);
      if (sharePaisa === 0) {
        continue;
      }
      const bucket = bucketFor(participant.memberId, expense.payerMemberId);
      const item: PairwiseExpenseItem = {
        expenseId: expense.expenseId,
        description: expense.description,
        occurredAt: expense.occurredAt,
        amount: fromPaisa(sharePaisa),
      };
      if (participant.memberId === bucket.low) {
        bucket.owedLowToHigh += sharePaisa;
        bucket.expensesLowToHigh.push(item);
      } else {
        bucket.owedHighToLow += sharePaisa;
        bucket.expensesHighToLow.push(item);
      }
    }
  }

  for (const transfer of input.transfers) {
    if (!isCountedStatus(transfer.status)) {
      continue;
    }
    if (
      !memberIds.has(transfer.fromMemberId) ||
      !memberIds.has(transfer.toMemberId) ||
      transfer.fromMemberId === transfer.toMemberId
    ) {
      continue;
    }
    const amountPaisa = toPaisa(transfer.amount);
    const bucket = bucketFor(transfer.fromMemberId, transfer.toMemberId);
    bucket.settlements.push({
      transferId: transfer.transferId,
      status: transfer.status,
      occurredAt: transfer.occurredAt,
      amount: fromPaisa(amountPaisa),
    });
    if (transfer.status === "pending") {
      if (transfer.fromMemberId === bucket.low) {
        bucket.pendingLowToHigh += amountPaisa;
      } else {
        bucket.pendingHighToLow += amountPaisa;
      }
      continue;
    }
    if (transfer.fromMemberId === bucket.low) {
      bucket.settledLowToHigh += amountPaisa;
    } else {
      bucket.settledLowToHigh -= amountPaisa;
    }
  }

  const debts: PairwiseDebt[] = [];

  for (const bucket of buckets.values()) {
    const remainingLowToHigh =
      bucket.owedLowToHigh - bucket.owedHighToLow - bucket.settledLowToHigh;
    const hasPending =
      bucket.pendingLowToHigh > 0 || bucket.pendingHighToLow > 0;

    if (remainingLowToHigh === 0 && !hasPending) {
      continue;
    }

    let debtor = bucket.low;
    let creditor = bucket.high;
    let remainingPaisa = remainingLowToHigh;
    let grossOwed = bucket.owedLowToHigh;
    let grossOwedBack = bucket.owedHighToLow;
    let settledPaisa = bucket.settledLowToHigh;
    let pendingPaisa = bucket.pendingLowToHigh;
    let expenses = bucket.expensesLowToHigh;
    let offsetExpenses = bucket.expensesHighToLow;

    if (remainingLowToHigh < 0) {
      debtor = bucket.high;
      creditor = bucket.low;
      remainingPaisa = -remainingLowToHigh;
      grossOwed = bucket.owedHighToLow;
      grossOwedBack = bucket.owedLowToHigh;
      settledPaisa = -bucket.settledLowToHigh;
      pendingPaisa = bucket.pendingHighToLow;
      expenses = bucket.expensesHighToLow;
      offsetExpenses = bucket.expensesLowToHigh;
    } else if (remainingLowToHigh === 0) {
      if (bucket.pendingHighToLow > bucket.pendingLowToHigh) {
        debtor = bucket.high;
        creditor = bucket.low;
        pendingPaisa = bucket.pendingHighToLow;
        grossOwed = bucket.owedHighToLow;
        grossOwedBack = bucket.owedLowToHigh;
        settledPaisa = -bucket.settledLowToHigh;
        expenses = bucket.expensesHighToLow;
        offsetExpenses = bucket.expensesLowToHigh;
      }
    }

    debts.push({
      debtorMemberId: debtor,
      creditorMemberId: creditor,
      grossOwed: fromPaisa(grossOwed),
      grossOwedBack: fromPaisa(grossOwedBack),
      settled: fromPaisa(settledPaisa),
      pending: fromPaisa(pendingPaisa),
      remaining: fromPaisa(remainingPaisa),
      expenses,
      offsetExpenses,
      settlements: bucket.settlements,
    });
  }

  debts.sort((a, b) => {
    if (b.remaining !== a.remaining) {
      return b.remaining - a.remaining;
    }
    return `${a.debtorMemberId}:${a.creditorMemberId}`.localeCompare(
      `${b.debtorMemberId}:${b.creditorMemberId}`,
    );
  });

  return debts;
}

/** Sum of pairwise remaining for a member (credit − debit) in paisa. */
export function pairwiseNetPaisa(
  memberId: string,
  debts: PairwiseDebt[],
): number {
  let paisa = 0;
  for (const debt of debts) {
    if (debt.creditorMemberId === memberId) {
      paisa += toPaisa(debt.remaining);
    } else if (debt.debtorMemberId === memberId) {
      paisa -= toPaisa(debt.remaining);
    }
  }
  return paisa;
}
