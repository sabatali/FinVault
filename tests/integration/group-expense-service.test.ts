import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createGroupExpense,
  deleteGroupExpense,
  GroupExpenseMutationError,
  updateGroupExpense,
} from "@/lib/group-expense-service";
import { assertAccountBalanceMatchesLedger } from "@/lib/ledger";
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
  createUser,
  linkMemberAccount,
} from "../helpers/fixtures";

describe("createGroupExpense service", () => {
  beforeAll(async () => {
    await startTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  it("equal-splits 100.00 across 3 members", async () => {
    const payer = await createUser({ email: "a@ex.com" });
    const b = await createUser({ email: "b@ex.com" });
    const account = await createAccountWithOpening({ owner: payer });
    const { group, adminMember, otherMember, guestMember } =
      await createGroupWithMembers({
        admin: payer,
        otherRegistered: b,
        guestEmail: "g@ex.com",
      });
    await linkMemberAccount({ group, member: adminMember, account });

    const expense = await createGroupExpense({
      group,
      createdByUserId: payer._id.toString(),
      data: {
        description: "Split 100",
        amount: 100,
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

    const shares = expense.participants
      .map((row) => row.shareAmount)
      .sort((x, y) => x - y);
    expect(shares).toEqual([33.33, 33.33, 33.34]);
    expect(expense.transactionId).toBeTruthy();
  });

  it("rejects a manual split that does not sum", async () => {
    const payer = await createUser({ email: "a2@ex.com" });
    const b = await createUser({ email: "b2@ex.com" });
    const account = await createAccountWithOpening({ owner: payer });
    const { group, adminMember, otherMember } = await createGroupWithMembers({
      admin: payer,
      otherRegistered: b,
    });
    await linkMemberAccount({ group, member: adminMember, account });

    try {
      await createGroupExpense({
        group,
        createdByUserId: payer._id.toString(),
        data: {
          description: "Bad split",
          amount: 300,
          occurredAt: new Date(),
          splitType: "manual",
          payerMemberId: adminMember._id.toString(),
          participantMemberIds: [
            adminMember._id.toString(),
            otherMember!._id.toString(),
          ],
          shares: [
            { memberId: adminMember._id.toString(), amount: 100 },
            { memberId: otherMember!._id.toString(), amount: 100 },
          ],
        },
      });
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(GroupExpenseMutationError);
      const mutation = error as GroupExpenseMutationError;
      expect(mutation.status).toBe(400);
      expect(mutation.code).toBe("SHARES_MUST_SUM_TO_TOTAL");
      expect(mutation.expected).toBe(300);
      expect(mutation.actual).toBe(200);
    }
  });

  it("guest payer creates no Transaction", async () => {
    const admin = await createUser({ email: "admin3@ex.com" });
    const { group, adminMember, guestMember } = await createGroupWithMembers({
      admin,
      guestEmail: "guest3@ex.com",
    });

    const expense = await createGroupExpense({
      group,
      createdByUserId: admin._id.toString(),
      data: {
        description: "Guest paid",
        amount: 90,
        occurredAt: new Date(),
        splitType: "equal",
        payerMemberId: guestMember!._id.toString(),
        participantMemberIds: [
          adminMember._id.toString(),
          guestMember!._id.toString(),
        ],
      },
    });

    expect(expense.transactionId).toBeNull();
    expect(await Transaction.countDocuments({ sourceId: expense._id })).toBe(0);
  });

  it("registered payer without a linked account is 400 NO_PAYER_ACCOUNT", async () => {
    const payer = await createUser({ email: "a4@ex.com" });
    const b = await createUser({ email: "b4@ex.com" });
    const { group, adminMember, otherMember } = await createGroupWithMembers({
      admin: payer,
      otherRegistered: b,
    });

    try {
      await createGroupExpense({
        group,
        createdByUserId: payer._id.toString(),
        data: {
          description: "No link",
          amount: 40,
          occurredAt: new Date(),
          splitType: "equal",
          payerMemberId: adminMember._id.toString(),
          participantMemberIds: [
            adminMember._id.toString(),
            otherMember!._id.toString(),
          ],
        },
      });
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(GroupExpenseMutationError);
      expect((error as GroupExpenseMutationError).code).toBe("NO_PAYER_ACCOUNT");
    }
  });

  it("explicit unlinked payer account is 400 ACCOUNT_NOT_LINKED", async () => {
    const payer = await createUser({ email: "a5@ex.com" });
    const b = await createUser({ email: "b5@ex.com" });
    const account = await createAccountWithOpening({ owner: payer });
    const { group, adminMember, otherMember } = await createGroupWithMembers({
      admin: payer,
      otherRegistered: b,
    });

    try {
      await createGroupExpense({
        group,
        createdByUserId: payer._id.toString(),
        data: {
          description: "Not linked",
          amount: 40,
          occurredAt: new Date(),
          splitType: "equal",
          payerMemberId: adminMember._id.toString(),
          payerAccountId: account._id.toString(),
          participantMemberIds: [
            adminMember._id.toString(),
            otherMember!._id.toString(),
          ],
        },
      });
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(GroupExpenseMutationError);
      expect((error as GroupExpenseMutationError).code).toBe(
        "ACCOUNT_NOT_LINKED",
      );
    }
  });

  it("create → edit → delete restores the payer balance", async () => {
    const payer = await createUser({ email: "a6@ex.com" });
    const b = await createUser({ email: "b6@ex.com" });
    const account = await createAccountWithOpening({
      owner: payer,
      openingBalance: 1000,
    });
    const start = account.cachedBalance;
    const { group, adminMember, otherMember } = await createGroupWithMembers({
      admin: payer,
      otherRegistered: b,
    });
    await linkMemberAccount({ group, member: adminMember, account });

    const created = await createGroupExpense({
      group,
      createdByUserId: payer._id.toString(),
      data: {
        description: "Trip",
        amount: 100,
        occurredAt: new Date(),
        splitType: "equal",
        payerMemberId: adminMember._id.toString(),
        participantMemberIds: [
          adminMember._id.toString(),
          otherMember!._id.toString(),
        ],
      },
    });

    expect((await Account.findById(account._id))!.cachedBalance).toBe(900);

    await updateGroupExpense({
      group,
      expense: created,
      data: {
        description: "Trip",
        amount: 50,
        occurredAt: new Date(),
        splitType: "equal",
        payerMemberId: adminMember._id.toString(),
        participantMemberIds: [
          adminMember._id.toString(),
          otherMember!._id.toString(),
        ],
      },
    });

    expect((await Account.findById(account._id))!.cachedBalance).toBe(950);

    const latest = await (await import("@/models/GroupExpense")).GroupExpense.findById(
      created._id,
    );
    await deleteGroupExpense({ group, expense: latest! });

    expect((await Account.findById(account._id))!.cachedBalance).toBe(start);
    await assertAccountBalanceMatchesLedger(account._id);
  });
});
