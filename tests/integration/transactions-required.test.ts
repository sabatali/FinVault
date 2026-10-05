import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createGroupExpense } from "@/lib/group-expense-service";
import * as ledger from "@/lib/ledger";
import { Account } from "@/models/Account";
import { GroupExpense } from "@/models/GroupExpense";
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

describe("transactions required", () => {
  beforeAll(async () => {
    await startTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rolls back expense + ledger when postLedgerEntry throws after Transaction.create", async () => {
    const payer = await createUser({ email: "payer@ex.com", name: "Payer" });
    const other = await createUser({ email: "other@ex.com", name: "Other" });
    const account = await createAccountWithOpening({
      owner: payer,
      openingBalance: 5000,
    });
    const startingBalance = account.cachedBalance;
    const { group, adminMember, otherMember } = await createGroupWithMembers({
      admin: payer,
      otherRegistered: other,
    });
    await linkMemberAccount({
      group,
      member: adminMember,
      account,
    });

    vi.spyOn(ledger, "postLedgerEntry").mockImplementation(async (input) => {
      await Transaction.create(
        [
          {
            account: input.accountId,
            user: input.userId,
            entryType: input.entryType,
            amount: input.amount,
            currency: "PKR",
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            description: input.description ?? "",
            occurredAt: new Date(),
          },
        ],
        input.session ? { session: input.session } : undefined,
      );
      throw new Error("forced ledger failure after Transaction.create");
    });

    await expect(
      createGroupExpense({
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
          ],
        },
      }),
    ).rejects.toThrow(/forced ledger failure/);

    expect(await GroupExpense.countDocuments({ group: group._id })).toBe(0);
    expect(await Transaction.countDocuments({ sourceType: "group_expense" })).toBe(
      0,
    );
    const refreshed = await Account.findById(account._id);
    expect(refreshed?.cachedBalance).toBe(startingBalance);
  });
});
