import { fromPaisa, toPaisa } from "@/lib/splits";

export interface SettleNetInput {
  memberId: string;
  net: number;
}

export interface SettleSuggestion {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

interface Party {
  memberId: string;
  /** Remaining absolute balance in paisa (always ≥ 0). */
  amountPaisa: number;
}

/**
 * Greedy debt simplification: pair largest debtor with largest creditor until
 * all nets clear. Does not claim a true minimum-edge graph; clears balances.
 */
export function suggestTransfers(
  nets: SettleNetInput[],
): SettleSuggestion[] {
  const debtors: Party[] = [];
  const creditors: Party[] = [];

  for (const row of nets) {
    const paisa = toPaisa(row.net);
    if (paisa < 0) {
      debtors.push({ memberId: row.memberId, amountPaisa: -paisa });
    } else if (paisa > 0) {
      creditors.push({ memberId: row.memberId, amountPaisa: paisa });
    }
  }

  debtors.sort((a, b) => b.amountPaisa - a.amountPaisa);
  creditors.sort((a, b) => b.amountPaisa - a.amountPaisa);

  const suggestions: SettleSuggestion[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const payPaisa = Math.min(debtor.amountPaisa, creditor.amountPaisa);

    if (payPaisa > 0) {
      suggestions.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount: fromPaisa(payPaisa),
      });
    }

    debtor.amountPaisa -= payPaisa;
    creditor.amountPaisa -= payPaisa;

    if (debtor.amountPaisa === 0) {
      i += 1;
    }
    if (creditor.amountPaisa === 0) {
      j += 1;
    }
  }

  // Absorb any leftover 1-paisa drift on the last pair so simulation clears.
  const leftoverDebtor = debtors.find((party) => party.amountPaisa > 0);
  const leftoverCreditor = creditors.find((party) => party.amountPaisa > 0);
  if (
    leftoverDebtor &&
    leftoverCreditor &&
    leftoverDebtor.amountPaisa === leftoverCreditor.amountPaisa
  ) {
    const payPaisa = leftoverDebtor.amountPaisa;
    if (payPaisa > 0) {
      suggestions.push({
        fromMemberId: leftoverDebtor.memberId,
        toMemberId: leftoverCreditor.memberId,
        amount: fromPaisa(payPaisa),
      });
      leftoverDebtor.amountPaisa = 0;
      leftoverCreditor.amountPaisa = 0;
    }
  }

  return suggestions.filter((row) => toPaisa(row.amount) > 0);
}

/** Apply suggestions to nets the same way confirmed transfers adjust balances. */
export function applySuggestionsToNets(
  nets: SettleNetInput[],
  suggestions: SettleSuggestion[],
): SettleNetInput[] {
  const paisaByMember = new Map<string, number>();
  for (const row of nets) {
    paisaByMember.set(row.memberId, toPaisa(row.net));
  }

  for (const suggestion of suggestions) {
    paisaByMember.set(
      suggestion.fromMemberId,
      (paisaByMember.get(suggestion.fromMemberId) ?? 0) +
        toPaisa(suggestion.amount),
    );
    paisaByMember.set(
      suggestion.toMemberId,
      (paisaByMember.get(suggestion.toMemberId) ?? 0) -
        toPaisa(suggestion.amount),
    );
  }

  return [...paisaByMember.entries()].map(([memberId, paisa]) => ({
    memberId,
    net: fromPaisa(paisa),
  }));
}

export function suggestionsClearAllNets(
  nets: SettleNetInput[],
  suggestions: SettleSuggestion[],
): boolean {
  return applySuggestionsToNets(nets, suggestions).every(
    (row) => toPaisa(row.net) === 0,
  );
}
