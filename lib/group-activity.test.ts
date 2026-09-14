import { describe, expect, it } from "vitest";

import {
  buildExpenseActivityEvent,
  buildTransferActivityEvent,
  expenseOweLines,
  filterGroupActivity,
  hasActiveGroupActivityFilters,
  mergeGroupActivity,
  transferHeadline,
  transferStatusLabel,
  viewerSignedDelta,
  type GroupActivityFilters,
} from "@/lib/group-activity";
import { owedFromLine, owesToLine } from "@/lib/owes-labels";
import type { GroupExpensePublic } from "@/models/GroupExpense";
import type { GroupTransferPublic } from "@/models/GroupTransfer";

function expense(overrides: Partial<GroupExpensePublic> = {}): GroupExpensePublic {
  return {
    id: "e1",
    group: "g1",
    description: "Dinner",
    amount: 3000,
    currency: "PKR",
    splitType: "equal",
    payerMemberId: "ali",
    payerDisplayName: "Ali",
    payerAccountId: null,
    participants: [
      { memberId: "ali", displayName: "Ali", shareAmount: 1000 },
      { memberId: "sara", displayName: "Sara", shareAmount: 1000 },
      { memberId: "ahmed", displayName: "Ahmed", shareAmount: 1000 },
    ],
    occurredAt: "2026-09-10T12:00:00.000Z",
    createdBy: "u1",
    transactionId: null,
    createdAt: "2026-09-10T12:05:00.000Z",
    updatedAt: "2026-09-10T12:05:00.000Z",
    ...overrides,
  };
}

function transfer(
  overrides: Partial<GroupTransferPublic> = {},
): GroupTransferPublic {
  return {
    id: "t1",
    group: "g1",
    fromMemberId: "sara",
    toMemberId: "ali",
    fromDisplayName: "Sara",
    toDisplayName: "Ali",
    fromAccountId: null,
    toAccountId: null,
    amount: 1500,
    currency: "PKR",
    status: "pending",
    createdBy: "u2",
    resolvedBy: null,
    resolvedAt: null,
    createdAt: "2026-09-12T09:00:00.000Z",
    updatedAt: "2026-09-12T09:00:00.000Z",
    ...overrides,
  };
}

const defaultFilters: GroupActivityFilters = {
  from: "",
  to: "",
  memberId: "",
  type: "all",
  status: "all",
};

describe("mergeGroupActivity", () => {
  it("includes pending transfers and sorts newest first", () => {
    const olderExpense = expense({
      id: "e-old",
      occurredAt: "2026-09-01T00:00:00.000Z",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    const newerExpense = expense({
      id: "e-new",
      occurredAt: "2026-09-14T00:00:00.000Z",
      createdAt: "2026-09-14T00:00:00.000Z",
    });
    const pending = transfer({ id: "t-pending", status: "pending" });
    const confirmed = transfer({
      id: "t-confirmed",
      status: "confirmed",
      createdAt: "2026-09-13T09:00:00.000Z",
    });

    const events = mergeGroupActivity(
      [olderExpense, newerExpense],
      [pending, confirmed],
    );

    expect(events.map((event) => event.id)).toEqual([
      "e-new",
      "t-confirmed",
      "t-pending",
      "e-old",
    ]);
    expect(events.some((event) => event.id === "t-pending")).toBe(true);
  });
});

describe("viewerSignedDelta", () => {
  it("marks the payer as owed (paid minus share) and participants as owing", () => {
    const event = buildExpenseActivityEvent(expense());
    expect(viewerSignedDelta(event, "ali")).toBe(2000);
    expect(viewerSignedDelta(event, "sara")).toBe(-1000);
    expect(viewerSignedDelta(event, "outsider")).toBe(0);
  });

  it("signs transfers as + received / − sent, including pending", () => {
    const event = buildTransferActivityEvent(transfer());
    expect(viewerSignedDelta(event, "ali")).toBe(1500);
    expect(viewerSignedDelta(event, "sara")).toBe(-1500);
    expect(viewerSignedDelta(event, "ahmed")).toBe(0);
  });
});

describe("filterGroupActivity", () => {
  const events = mergeGroupActivity(
    [expense()],
    [
      transfer(),
      transfer({
        id: "t-rejected",
        status: "rejected",
        createdAt: "2026-09-11T09:00:00.000Z",
      }),
      transfer({
        id: "t-auto",
        status: "auto_confirmed",
        fromMemberId: "ahmed",
        toMemberId: "ali",
        fromDisplayName: "Ahmed",
        createdAt: "2026-09-08T09:00:00.000Z",
      }),
    ],
  );

  it("combines type, status, member, and date with AND logic", () => {
    const filtered = filterGroupActivity(events, {
      ...defaultFilters,
      type: "transfer",
      status: "pending",
      memberId: "sara",
      from: "2026-09-12",
      to: "2026-09-12",
    });
    expect(filtered.map((event) => event.id)).toEqual(["t1"]);
  });

  it("treats auto-confirmed as confirmed for the status filter", () => {
    const filtered = filterGroupActivity(events, {
      ...defaultFilters,
      type: "transfer",
      status: "confirmed",
    });
    expect(filtered.map((event) => event.id)).toEqual(["t-auto"]);
  });

  it("excludes expenses when a transfer status filter is set", () => {
    const filtered = filterGroupActivity(events, {
      ...defaultFilters,
      status: "pending",
    });
    expect(filtered.every((event) => event.kind === "transfer")).toBe(true);
    expect(filtered.map((event) => event.id)).toEqual(["t1"]);
  });

  it("filters by member involvement on expenses", () => {
    const filtered = filterGroupActivity(events, {
      ...defaultFilters,
      memberId: "ahmed",
      type: "expense",
    });
    expect(filtered.map((event) => event.id)).toEqual(["e1"]);
  });
});

describe("copy helpers", () => {
  it("builds bilingual owe lines for expense shares", () => {
    const lines = expenseOweLines(expense(), (amount) => `₨${amount}`);
    expect(lines).toEqual([
      owesToLine("Sara", "₨1000", "Ali"),
      owesToLine("Ahmed", "₨1000", "Ali"),
    ]);
  });

  it("uses Owed / Lenay Hain when the viewer received a transfer", () => {
    const line = transferHeadline(transfer(), "ali", (amount) => `₨${amount}`);
    expect(line).toBe(owedFromLine("Ali", "₨1500", "Sara"));
  });

  it("uses Owes / Denay Hain when the viewer sent a transfer", () => {
    const line = transferHeadline(transfer(), "sara", (amount) => `₨${amount}`);
    expect(line).toBe(owesToLine("Sara", "₨1500", "Ali"));
  });

  it("labels every transfer status including auto-confirmed", () => {
    expect(transferStatusLabel("pending")).toBe("Pending");
    expect(transferStatusLabel("confirmed")).toBe("Confirmed");
    expect(transferStatusLabel("rejected")).toBe("Rejected");
    expect(transferStatusLabel("auto_confirmed")).toBe("Auto-confirmed");
  });

  it("detects active filters", () => {
    expect(hasActiveGroupActivityFilters(defaultFilters)).toBe(false);
    expect(
      hasActiveGroupActivityFilters({ ...defaultFilters, type: "expense" }),
    ).toBe(true);
  });
});
