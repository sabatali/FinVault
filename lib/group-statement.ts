import type {
  BalanceExpenseInput,
  BalanceMemberInput,
  BalanceTransferInput,
} from "@/lib/group-balances";
import { fromPaisa, toPaisa } from "@/lib/splits";
import type { GroupTransferStatus } from "@/models/GroupTransfer";

export interface StatementRow {
  date: string;
  kind:
    | "expense_paid"
    | "expense_share"
    | "settlement_sent"
    | "settlement_received";
  refId: string;
  description: string;
  counterparty: string | null;
  paid: number;
  share: number;
  effect: number;
  runningBalance: number;
  status?: "pending" | "confirmed" | "auto_confirmed";
}

export interface MemberStatement {
  openingBalance: number;
  rows: StatementRow[];
  closingBalance: number;
  totals: {
    paid: number;
    share: number;
    settlementsSent: number;
    settlementsReceived: number;
  };
}

export type StatementExpenseInput = BalanceExpenseInput & {
  expenseId: string;
  description: string;
  occurredAt: string;
  createdAt: string;
};

export type StatementTransferInput = BalanceTransferInput & {
  transferId: string;
  status: GroupTransferStatus;
  occurredAt: string;
  createdAt: string;
};

interface DraftRow {
  occurredAt: string;
  createdAt: string;
  row: Omit<StatementRow, "runningBalance">;
}

function nameOf(
  members: BalanceMemberInput[],
  memberId: string,
): string {
  return members.find((member) => member.memberId === memberId)?.displayName ??
    "Member";
}

function inRange(
  iso: string,
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (from && iso < from) {
    return false;
  }
  if (to && iso > to) {
    return false;
  }
  return true;
}

export function buildMemberStatement(input: {
  memberId: string;
  members: BalanceMemberInput[];
  expenses: StatementExpenseInput[];
  transfers: StatementTransferInput[];
  from?: string | null;
  to?: string | null;
}): MemberStatement {
  const drafts: DraftRow[] = [];
  const from = input.from ?? null;
  const to = input.to ?? null;

  for (const expense of input.expenses) {
    const isPayer = expense.payerMemberId === input.memberId;
    const participant = expense.participants.find(
      (row) => row.memberId === input.memberId,
    );
    if (!isPayer && !participant) {
      continue;
    }

    const paid = isPayer ? toPaisa(expense.amount) : 0;
    const share = participant ? toPaisa(participant.shareAmount) : 0;
    const kind = isPayer ? "expense_paid" : "expense_share";
    const payerName = nameOf(input.members, expense.payerMemberId);
    const description = isPayer
      ? expense.description
      : `${expense.description} (paid by ${payerName})`;

    drafts.push({
      occurredAt: expense.occurredAt,
      createdAt: expense.createdAt,
      row: {
        date: expense.occurredAt,
        kind,
        refId: expense.expenseId,
        description,
        counterparty: isPayer ? null : payerName,
        paid: fromPaisa(paid),
        share: fromPaisa(share),
        effect: fromPaisa(paid - share),
      },
    });
  }

  for (const transfer of input.transfers) {
    if (transfer.status === "rejected") {
      continue;
    }
    const isSender = transfer.fromMemberId === input.memberId;
    const isReceiver = transfer.toMemberId === input.memberId;
    if (!isSender && !isReceiver) {
      continue;
    }

    const pending = transfer.status === "pending";
    const amountPaisa = toPaisa(transfer.amount);
    const otherId = isSender ? transfer.toMemberId : transfer.fromMemberId;
    const otherName = nameOf(input.members, otherId);
    const effectPaisa = pending
      ? 0
      : isSender
        ? amountPaisa
        : -amountPaisa;

    drafts.push({
      occurredAt: transfer.occurredAt,
      createdAt: transfer.createdAt,
      row: {
        date: transfer.occurredAt,
        kind: isSender ? "settlement_sent" : "settlement_received",
        refId: transfer.transferId,
        description: isSender
          ? `Settlement to ${otherName}`
          : `Settlement from ${otherName}`,
        counterparty: otherName,
        paid: isSender ? fromPaisa(amountPaisa) : 0,
        share: isSender ? 0 : fromPaisa(amountPaisa),
        effect: fromPaisa(effectPaisa),
        status: transfer.status,
      },
    });
  }

  drafts.sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) {
      return a.occurredAt.localeCompare(b.occurredAt);
    }
    if (a.createdAt !== b.createdAt) {
      return a.createdAt.localeCompare(b.createdAt);
    }
    return a.row.refId.localeCompare(b.row.refId);
  });

  let openingPaisa = 0;
  const inRangeDrafts: DraftRow[] = [];
  for (const draft of drafts) {
    if (from && draft.occurredAt < from) {
      openingPaisa += toPaisa(draft.row.effect);
      continue;
    }
    if (!inRange(draft.occurredAt, from, to)) {
      continue;
    }
    inRangeDrafts.push(draft);
  }

  let running = openingPaisa;
  const rows: StatementRow[] = inRangeDrafts.map((draft) => {
    running += toPaisa(draft.row.effect);
    return {
      ...draft.row,
      runningBalance: fromPaisa(running),
    };
  });

  let paidPaisa = 0;
  let sharePaisa = 0;
  let sentPaisa = 0;
  let receivedPaisa = 0;
  for (const row of rows) {
    if (row.kind === "expense_paid" || row.kind === "expense_share") {
      paidPaisa += toPaisa(row.paid);
      sharePaisa += toPaisa(row.share);
    }
    if (row.status === "pending") {
      continue;
    }
    if (row.kind === "settlement_sent") {
      sentPaisa += toPaisa(row.paid);
    }
    if (row.kind === "settlement_received") {
      receivedPaisa += toPaisa(row.share);
    }
  }

  return {
    openingBalance: fromPaisa(openingPaisa),
    rows,
    closingBalance: fromPaisa(running),
    totals: {
      paid: fromPaisa(paidPaisa),
      share: fromPaisa(sharePaisa),
      settlementsSent: fromPaisa(sentPaisa),
      settlementsReceived: fromPaisa(receivedPaisa),
    },
  };
}
