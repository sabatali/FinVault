import { roundAmount } from "@/lib/money";

export interface EqualShare {
  memberId: string;
  shareAmount: number;
}

export type ManualShareInput = {
  memberId: string;
  amount: number;
};

export class SharesSumError extends Error {
  code = "SHARES_MUST_SUM_TO_TOTAL" as const;
  expected: number;
  actual: number;

  constructor(expected: number, actual: number) {
    super(
      `Shares must sum to ${expected.toFixed(2)} (got ${actual.toFixed(2)}).`,
    );
    this.name = "SharesSumError";
    this.expected = expected;
    this.actual = actual;
  }
}

export function toPaisa(amount: number): number {
  return Math.round(roundAmount(amount) * 100);
}

export function fromPaisa(paisa: number): number {
  return roundAmount(paisa / 100);
}

/**
 * Equal split using the largest-remainder method (in integer cents).
 * Base share is floor(totalCents / n); leftover cents go to participants
 * with the largest fractional remainders (stable by input order on ties)
 * so shareAmounts always sum exactly to the rounded total.
 */
export function equalShares(
  total: number,
  memberIds: string[],
): EqualShare[] {
  const uniqueIds = [...new Set(memberIds)];
  if (uniqueIds.length === 0) {
    throw new Error("At least one participant is required");
  }
  if (uniqueIds.length !== memberIds.length) {
    throw new Error("Participant ids must be unique");
  }

  const totalCents = toPaisa(total);
  if (totalCents <= 0) {
    throw new Error("Total must be greater than zero");
  }

  const n = uniqueIds.length;
  const exact = totalCents / n;

  const rows = uniqueIds.map((memberId, index) => {
    const floorCents = Math.floor(exact);
    return {
      memberId,
      index,
      floorCents,
      fraction: exact - floorCents,
    };
  });

  const assigned = rows.reduce((sum, row) => sum + row.floorCents, 0);
  const leftover = totalCents - assigned;

  rows.sort((a, b) => {
    if (b.fraction !== a.fraction) {
      return b.fraction - a.fraction;
    }
    return a.index - b.index;
  });

  for (let i = 0; i < leftover; i += 1) {
    rows[i]!.floorCents += 1;
  }

  rows.sort((a, b) => a.index - b.index);

  return rows.map((row) => ({
    memberId: row.memberId,
    shareAmount: fromPaisa(row.floorCents),
  }));
}

export function sumShareAmounts(shares: EqualShare[]): number {
  return fromPaisa(
    shares.reduce((sum, share) => sum + toPaisa(share.shareAmount), 0),
  );
}

/** Remaining = total − sum(rounded share inputs), in currency units. */
export function sharesRemaining(
  total: number,
  shareAmounts: number[],
): number {
  const totalPaisa = toPaisa(total);
  const sumPaisa = shareAmounts.reduce(
    (sum, value) => sum + toPaisa(Number.isFinite(value) ? value : 0),
    0,
  );
  return fromPaisa(totalPaisa - sumPaisa);
}

/**
 * Validates manual shares: each amount > 0 after rounding, unique members,
 * and paisa sum equals the expense total.
 */
export function assertSharesSumToTotal(
  total: number,
  shares: ManualShareInput[],
): EqualShare[] {
  if (shares.length === 0) {
    throw new Error("At least one share is required");
  }

  const ids = shares.map((share) => share.memberId);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Participant ids must be unique");
  }

  const normalized: EqualShare[] = shares.map((share) => {
    const shareAmount = roundAmount(share.amount);
    if (!(shareAmount > 0)) {
      throw new Error("Each share must be greater than zero");
    }
    return {
      memberId: share.memberId,
      shareAmount,
    };
  });

  const expected = roundAmount(total);
  const actual = sumShareAmounts(normalized);
  if (toPaisa(actual) !== toPaisa(expected)) {
    throw new SharesSumError(expected, actual);
  }

  return normalized;
}
