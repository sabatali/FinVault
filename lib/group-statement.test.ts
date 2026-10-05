import { describe, expect, it } from "vitest";

import { aggregateGroupBalances } from "@/lib/group-balances";
import { buildMemberStatement } from "@/lib/group-statement";
import { suggestTransfers } from "@/lib/settle";
import { toPaisa } from "@/lib/splits";
import {
  SCENARIO_1_MEMBERS,
  SCENARIO_2_MEMBERS,
  scenario1Expenses,
  scenario2Expenses,
} from "@/tests/helpers/settlement-scenarios";

describe("buildMemberStatement", () => {
  it("Scenario 1 member B: 10 rows, closing −300", () => {
    const expenses = scenario1Expenses();
    const statement = buildMemberStatement({
      memberId: "b",
      members: SCENARIO_1_MEMBERS,
      expenses,
      transfers: [],
    });
    expect(statement.rows).toHaveLength(10);
    expect(statement.closingBalance).toBe(-300);
    const balances = aggregateGroupBalances({
      members: SCENARIO_1_MEMBERS,
      expenses,
    });
    expect(statement.closingBalance).toBe(
      balances.members.find((member) => member.memberId === "b")?.net,
    );
  });

  it("Scenario 2 member C closing balance equals net", () => {
    const expenses = scenario2Expenses();
    const balances = aggregateGroupBalances({
      members: SCENARIO_2_MEMBERS,
      expenses,
    });
    const statement = buildMemberStatement({
      memberId: "c",
      members: SCENARIO_2_MEMBERS,
      expenses,
      transfers: [],
    });
    expect(toPaisa(statement.closingBalance)).toBe(
      toPaisa(balances.members.find((member) => member.memberId === "c")!.net),
    );
  });

  it("confirmed settlement moves running balance; pending does not", () => {
    const expenses = scenario2Expenses();
    const balances = aggregateGroupBalances({
      members: SCENARIO_2_MEMBERS,
      expenses,
    });
    const suggestion = suggestTransfers(
      balances.members.map((member) => ({
        memberId: member.memberId,
        net: member.net,
      })),
    ).find((row) => row.fromMemberId === "c" && row.toMemberId === "d");
    expect(suggestion).toBeTruthy();

    const confirmed = buildMemberStatement({
      memberId: "c",
      members: SCENARIO_2_MEMBERS,
      expenses,
      transfers: [
        {
          transferId: "t-cd",
          fromMemberId: "c",
          toMemberId: "d",
          amount: suggestion!.amount,
          status: "confirmed",
          occurredAt: "2026-01-21T12:00:00.000Z",
          createdAt: "2026-01-21T12:00:01.000Z",
        },
      ],
    });
    expect(
      confirmed.rows.some(
        (row) =>
          row.kind === "settlement_sent" &&
          row.refId === "t-cd" &&
          row.status === "confirmed",
      ),
    ).toBe(true);
    expect(toPaisa(confirmed.closingBalance)).toBe(
      toPaisa(balances.members.find((member) => member.memberId === "c")!.net) +
        toPaisa(suggestion!.amount),
    );

    const pending = buildMemberStatement({
      memberId: "c",
      members: SCENARIO_2_MEMBERS,
      expenses,
      transfers: [
        {
          transferId: "t-cd-pending",
          fromMemberId: "c",
          toMemberId: "d",
          amount: suggestion!.amount,
          status: "pending",
          occurredAt: "2026-01-21T12:00:00.000Z",
          createdAt: "2026-01-21T12:00:01.000Z",
        },
      ],
    });
    expect(pending.rows.some((row) => row.status === "pending")).toBe(true);
    expect(toPaisa(pending.closingBalance)).toBe(
      toPaisa(balances.members.find((member) => member.memberId === "c")!.net),
    );
  });
});
