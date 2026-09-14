import { describe, expect, it } from "vitest";

import { aggregateGroupBalances } from "@/lib/group-balances";
import {
  suggestTransfers,
  suggestionsClearAllNets,
} from "@/lib/settle";
import { toPaisa } from "@/lib/splits";

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
});
