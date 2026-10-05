import { describe, expect, it } from "vitest";

import { aggregateGroupBalances } from "@/lib/group-balances";
import {
  computePairwiseDebts,
  pairwiseNetPaisa,
} from "@/lib/group-pairwise";
import { suggestTransfers, suggestionsClearAllNets } from "@/lib/settle";
import { toPaisa } from "@/lib/splits";
import {
  SCENARIO_1_MEMBERS,
  SCENARIO_2_MEMBERS,
  scenario1Expenses,
  scenario2Expenses,
} from "@/tests/helpers/settlement-scenarios";

describe("computePairwiseDebts", () => {
  it("Scenario 1: B and C each owe A 300; B↔C drops", () => {
    const expenses = scenario1Expenses();
    const debts = computePairwiseDebts({
      members: SCENARIO_1_MEMBERS,
      expenses,
      transfers: [],
    });

    expect(debts).toHaveLength(2);
    const ba = debts.find(
      (debt) =>
        debt.debtorMemberId === "b" && debt.creditorMemberId === "a",
    );
    const ca = debts.find(
      (debt) =>
        debt.debtorMemberId === "c" && debt.creditorMemberId === "a",
    );
    expect(ba?.grossOwed).toBe(1200);
    expect(ba?.grossOwedBack).toBe(900);
    expect(ba?.remaining).toBe(300);
    expect(ca?.grossOwed).toBe(1200);
    expect(ca?.grossOwedBack).toBe(900);
    expect(ca?.remaining).toBe(300);
    expect(
      debts.some(
        (debt) =>
          (debt.debtorMemberId === "b" && debt.creditorMemberId === "c") ||
          (debt.debtorMemberId === "c" && debt.creditorMemberId === "b"),
      ),
    ).toBe(false);
  });

  it("pairwise remaining equals net for Scenario 1 and 2", () => {
    for (const [members, expenses] of [
      [SCENARIO_1_MEMBERS, scenario1Expenses()] as const,
      [SCENARIO_2_MEMBERS, scenario2Expenses()] as const,
    ]) {
      const balances = aggregateGroupBalances({ members, expenses });
      expect(toPaisa(balances.sumOfNets)).toBe(0);
      const debts = computePairwiseDebts({
        members,
        expenses,
        transfers: [],
      });
      for (const member of balances.members) {
        expect(pairwiseNetPaisa(member.memberId, debts)).toBe(
          toPaisa(member.net),
        );
      }
    }
  });

  it("Scenario 2 suggestions from nets clear everything", () => {
    const balances = aggregateGroupBalances({
      members: SCENARIO_2_MEMBERS,
      expenses: scenario2Expenses(),
    });
    expect(toPaisa(balances.sumOfNets)).toBe(0);
    const a = balances.members.find((member) => member.memberId === "a");
    const b = balances.members.find((member) => member.memberId === "b");
    const c = balances.members.find((member) => member.memberId === "c");
    const d = balances.members.find((member) => member.memberId === "d");
    expect(toPaisa(a?.net ?? 0)).toBe(27500);
    expect(toPaisa(b?.net ?? 0)).toBe(5833);
    expect(toPaisa(c?.net ?? 0)).toBe(-99167);
    expect(toPaisa(d?.net ?? 0)).toBe(65834);

    const nets = balances.members.map((member) => ({
      memberId: member.memberId,
      net: member.net,
    }));
    const suggestions = suggestTransfers(nets);
    expect(suggestionsClearAllNets(nets, suggestions)).toBe(true);
    expect(suggestions.every((row) => row.fromMemberId === "c")).toBe(true);
    expect(
      suggestions.find(
        (row) => row.toMemberId === "a" && row.amount === 275,
      ),
    ).toBeTruthy();
  });
});
