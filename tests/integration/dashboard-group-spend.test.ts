import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getPersonalDashboard } from "@/lib/dashboard-personal";
import { createGroupExpense } from "@/lib/group-expense-service";
import { assertAccountBalanceMatchesLedger } from "@/lib/ledger";
import { toTransactionPublicWithLinks } from "@/lib/transaction-links";
import { Account } from "@/models/Account";
import { Transaction } from "@/models/Transaction";
import {
  clearTestMongo,
  startTestMongo,
  stopTestMongo,
} from "../helpers/mongo";
import {
  createAccountWithOpening,
  createGroupWithMembers,
  createPersonalExpense,
  createUser,
  linkMemberAccount,
} from "../helpers/fixtures";

describe("personal dashboard includes group shares", () => {
  beforeAll(async () => {
    await startTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  it("adds the member share to expenseTotal and a Group expenses row", async () => {
    const payer = await createUser({ email: "payer@ex.com" });
    const other = await createUser({ email: "other@ex.com" });
    const account = await createAccountWithOpening({
      owner: payer,
      openingBalance: 5000,
    });
    await createPersonalExpense({
      user: payer,
      account,
      amount: 500,
      description: "Groceries",
    });

    const { group, adminMember, otherMember, guestMember } =
      await createGroupWithMembers({
        admin: payer,
        otherRegistered: other,
        guestEmail: "guest-dash@ex.com",
      });
    await linkMemberAccount({ group, member: adminMember, account });

    const expense = await createGroupExpense({
      group,
      createdByUserId: payer._id.toString(),
      data: {
        description: "Dinner",
        amount: 300,
        occurredAt: new Date(),
        splitType: "equal",
        payerMemberId: adminMember._id.toString(),
        participantMemberIds: [
          adminMember._id.toString(),
          otherMember!._id.toString(),
          guestMember!._id.toString(),
        ],
      },
    });

    const dashboard = await getPersonalDashboard(
      payer._id.toString(),
      "all",
    );

    expect(dashboard.expenseTotal).toBe(600);
    const groupRow = dashboard.spendByCategory.find(
      (row) => row.name === "Group expenses",
    );
    expect(groupRow?.amount).toBe(100);
    const percentSum = dashboard.spendByCategory.reduce(
      (sum, row) => sum + row.percent,
      0,
    );
    expect(percentSum).toBeGreaterThanOrEqual(99.9);
    expect(percentSum).toBeLessThanOrEqual(100.1);

    const otherDash = await getPersonalDashboard(
      other._id.toString(),
      "all",
    );
    expect(otherDash.expenseTotal).toBe(100);

    await createGroupExpense({
      group,
      createdByUserId: payer._id.toString(),
      data: {
        description: "Old dinner",
        amount: 90,
        occurredAt: new Date("2020-01-15T12:00:00.000Z"),
        splitType: "equal",
        payerMemberId: adminMember._id.toString(),
        participantMemberIds: [
          adminMember._id.toString(),
          otherMember!._id.toString(),
          guestMember!._id.toString(),
        ],
      },
    });
    const thisMonth = await getPersonalDashboard(
      payer._id.toString(),
      "this_month",
    );
    expect(
      thisMonth.spendByCategory.find((row) => row.name === "Group expenses")
        ?.amount,
    ).toBe(100);

    const before = (await Account.findById(account._id))!.cachedBalance;
    const ledgerRows = await Transaction.find({ account: account._id }).sort({
      occurredAt: -1,
    });
    const snapshot = ledgerRows.map((row) => row.toObject());
    const publicRows = await toTransactionPublicWithLinks(ledgerRows);
    const groupRowTx = publicRows.find(
      (row) => row.sourceId === expense._id.toString(),
    );
    expect(groupRowTx?.groupExpense).toEqual({
      yourShare: 100,
      othersShare: 200,
      groupId: group._id.toString(),
      groupName: group.name,
    });
    expect((await Account.findById(account._id))!.cachedBalance).toBe(before);
    const afterRows = await Transaction.find({ account: account._id }).sort({
      occurredAt: -1,
    });
    expect(afterRows.map((row) => row.toObject())).toEqual(snapshot);
    await assertAccountBalanceMatchesLedger(account._id);
  });
});
