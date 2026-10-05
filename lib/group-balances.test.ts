import { describe, expect, it } from "vitest";

import { aggregateGroupBalances } from "@/lib/group-balances";
import {
  suggestTransfers,
  suggestionsClearAllNets,
} from "@/lib/settle";
import { toPaisa } from "@/lib/splits";
import {
  SCENARIO_1_MEMBERS,
  scenario1Expenses,
} from "@/tests/helpers/settlement-scenarios";

describe("aggregateGroupBalances", () => {
  it("nets sum to ~0 after equal split", () => {
    const result = aggregateGroupBalances({
      members: [
        { memberId: "a", displayName: "A", memberType: "registered" },
        { memberId: "b", displayName: "B", memberType: "registered" },
        { memberId: "c", displayName: "C", memberType: "guest" },
      ],
      expenses: [
        {
          payerMemberId: "a",
          amount: 3000,
          participants: [
            { memberId: "a", shareAmount: 1000 },
            { memberId: "b", shareAmount: 1000 },
            { memberId: "c", shareAmount: 1000 },
          ],
        },
      ],
    });

    expect(toPaisa(result.sumOfNets)).toBe(0);
    expect(result.members.find((m) => m.memberId === "a")?.net).toBe(2000);
  });

  it("confirmed transfer adjusts nets; suggestions then clear", () => {
    const before = aggregateGroupBalances({
      members: [
        { memberId: "a", displayName: "A", memberType: "registered" },
        { memberId: "b", displayName: "B", memberType: "registered" },
      ],
      expenses: [
        {
          payerMemberId: "a",
          amount: 1000,
          participants: [
            { memberId: "a", shareAmount: 500 },
            { memberId: "b", shareAmount: 500 },
          ],
        },
      ],
    });

    const suggestions = suggestTransfers(
      before.members.map((m) => ({ memberId: m.memberId, net: m.net })),
    );
    expect(suggestionsClearAllNets(
      before.members.map((m) => ({ memberId: m.memberId, net: m.net })),
      suggestions,
    )).toBe(true);

    const after = aggregateGroupBalances({
      members: before.members.map((m) => ({
        memberId: m.memberId,
        displayName: m.displayName,
        memberType: m.memberType,
      })),
      expenses: [
        {
          payerMemberId: "a",
          amount: 1000,
          participants: [
            { memberId: "a", shareAmount: 500 },
            { memberId: "b", shareAmount: 500 },
          ],
        },
      ],
      transfers: suggestions.map((s) => ({
        fromMemberId: s.fromMemberId,
        toMemberId: s.toMemberId,
        amount: s.amount,
      })),
    });

    expect(toPaisa(after.sumOfNets)).toBe(0);
    expect(after.members.every((m) => toPaisa(m.net) === 0)).toBe(true);
  });

  it("Scenario 1 pending B→A 300 leaves A's net +600 and B netAfterPending 0", () => {
    const result = aggregateGroupBalances({
      members: SCENARIO_1_MEMBERS,
      expenses: scenario1Expenses(),
      pendingTransfers: [
        { fromMemberId: "b", toMemberId: "a", amount: 300 },
      ],
    });

    const a = result.members.find((member) => member.memberId === "a");
    const b = result.members.find((member) => member.memberId === "b");
    const c = result.members.find((member) => member.memberId === "c");
    expect(a?.net).toBe(600);
    expect(a?.pendingIn).toBe(300);
    expect(a?.netAfterPending).toBe(300);
    expect(b?.net).toBe(-300);
    expect(b?.pendingOut).toBe(300);
    expect(b?.netAfterPending).toBe(0);
    expect(c?.netAfterPending).toBe(-300);

    const suggestions = suggestTransfers(
      result.members.map((member) => ({
        memberId: member.memberId,
        net: member.netAfterPending,
      })),
    );
    expect(suggestions).toEqual([
      { fromMemberId: "c", toMemberId: "a", amount: 300 },
    ]);
    expect(
      suggestionsClearAllNets(
        result.members.map((member) => ({
          memberId: member.memberId,
          net: member.net,
        })),
        [
          { fromMemberId: "b", toMemberId: "a", amount: 300 },
          ...suggestions,
        ],
      ),
    ).toBe(true);
  });

  it("Scenario 1 rejected pending restores both suggestions", () => {
    const withPending = aggregateGroupBalances({
      members: SCENARIO_1_MEMBERS,
      expenses: scenario1Expenses(),
      pendingTransfers: [
        { fromMemberId: "b", toMemberId: "a", amount: 300 },
      ],
    });
    expect(
      suggestTransfers(
        withPending.members.map((member) => ({
          memberId: member.memberId,
          net: member.netAfterPending,
        })),
      ),
    ).toHaveLength(1);

    const afterReject = aggregateGroupBalances({
      members: SCENARIO_1_MEMBERS,
      expenses: scenario1Expenses(),
    });
    const suggestions = suggestTransfers(
      afterReject.members.map((member) => ({
        memberId: member.memberId,
        net: member.netAfterPending,
      })),
    );
    expect(suggestions).toEqual(
      expect.arrayContaining([
        { fromMemberId: "b", toMemberId: "a", amount: 300 },
        { fromMemberId: "c", toMemberId: "a", amount: 300 },
      ]),
    );
    expect(suggestions).toHaveLength(2);
  });
});
