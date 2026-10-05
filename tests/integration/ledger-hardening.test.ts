import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  assertAccountBalanceMatchesLedger,
  postLedgerEntry,
  reverseLedgerEntriesForSource,
  sumBalance,
} from "@/lib/ledger";
import {
  assertNoBalanceDrift,
  assertNoOrphanTransactions,
  findOrphanTransactions,
  runLedgerAudit,
} from "@/lib/ledger-audit";
import { AccountOwnershipError, InvalidLedgerAmountError } from "@/lib/ledger-errors";
import { claimGuestMembershipsForUser } from "@/lib/claim";
import { deleteGroupExpense, updateGroupExpense } from "@/lib/group-expense-service";
import { applyGroupTransferLedger } from "@/lib/group-transfer-ledger";
import { findOwnedAccount, getAccountDeletePolicy } from "@/lib/account-access";
import { findGroupMembership } from "@/lib/group-access";
import { withOptionalTransaction, withTransaction } from "@/lib/with-transaction";
import { Account } from "@/models/Account";
import { Expense } from "@/models/Expense";
import { GroupMember } from "@/models/GroupMember";
import { GroupTransfer } from "@/models/GroupTransfer";
import { Notification } from "@/models/Notification";
import { Transaction } from "@/models/Transaction";
import {
  clearTestMongo,
  startTestMongo,
  stopTestMongo,
} from "../helpers/mongo";
import {
  createAccountWithOpening,
  createEqualGroupExpense,
  createGroupWithMembers,
  createNotificationFor,
  createPersonalExpense,
  createPersonalIncome,
  createUser,
} from "../helpers/fixtures";

describe("ledger unit + audit", () => {
  beforeAll(async () => {
    await startTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  it("credits and debits update cache; reverse restores", async () => {
    const user = await createUser();
    const account = await createAccountWithOpening({
      owner: user,
      openingBalance: 1000,
    });

    const sourceId = new mongoose.Types.ObjectId();
    await postLedgerEntry({
      accountId: account._id,
      userId: user._id,
      entryType: "debit",
      amount: 250,
      sourceType: "expense",
      sourceId,
      description: "Lunch",
    });

    // Expense document required for orphan check
    await Expense.create({
      _id: sourceId,
      user: user._id,
      account: account._id,
      amount: 250,
      currency: "PKR",
      description: "Lunch",
      category: null,
      occurredAt: new Date(),
      transactionId: (await Transaction.findOne({ sourceId }))!._id,
    });

    await assertAccountBalanceMatchesLedger(account._id);
    expect(await sumBalance(account._id)).toBe(750);

    await reverseLedgerEntriesForSource({
      sourceType: "expense",
      sourceId,
    });
    await Expense.deleteOne({ _id: sourceId });

    const refreshed = await Account.findById(account._id);
    expect(refreshed?.cachedBalance).toBe(1000);
    await assertNoBalanceDrift();
    await assertNoOrphanTransactions();
  });

  it("rejects non-positive amounts", async () => {
    const user = await createUser();
    const account = await createAccountWithOpening({ owner: user });
    await expect(
      postLedgerEntry({
        accountId: account._id,
        userId: user._id,
        entryType: "debit",
        amount: 0,
        sourceType: "expense",
        sourceId: new mongoose.Types.ObjectId(),
      }),
    ).rejects.toBeInstanceOf(InvalidLedgerAmountError);
  });

  it("rejects posting to another user's account", async () => {
    const owner = await createUser({ email: "owner@ex.com" });
    const other = await createUser({ email: "other@ex.com" });
    const account = await createAccountWithOpening({ owner });

    await expect(
      postLedgerEntry({
        accountId: account._id,
        userId: other._id,
        entryType: "debit",
        amount: 10,
        sourceType: "expense",
        sourceId: new mongoose.Types.ObjectId(),
      }),
    ).rejects.toBeInstanceOf(AccountOwnershipError);
  });

  it("enforces unique sourceType+sourceId+account", async () => {
    const user = await createUser();
    const account = await createAccountWithOpening({ owner: user });
    const sourceId = new mongoose.Types.ObjectId();

    await postLedgerEntry({
      accountId: account._id,
      userId: user._id,
      entryType: "debit",
      amount: 10,
      sourceType: "expense",
      sourceId,
    });

    await expect(
      postLedgerEntry({
        accountId: account._id,
        userId: user._id,
        entryType: "debit",
        amount: 10,
        sourceType: "expense",
        sourceId,
      }),
    ).rejects.toThrow();
  });

  it("allows negative balances (insufficient funds warn-only)", async () => {
    const user = await createUser();
    const account = await createAccountWithOpening({
      owner: user,
      openingBalance: 50,
    });
    const { expenseId } = await createPersonalExpense({
      user,
      account,
      amount: 200,
    });

    const refreshed = await Account.findById(account._id);
    expect(refreshed?.cachedBalance).toBe(-150);
    await assertAccountBalanceMatchesLedger(account._id);
    expect(expenseId).toBeTruthy();
  });
});

describe("personal expense/income CRUD", () => {
  beforeAll(async () => {
    await startTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  it("create/edit/delete restores balance", async () => {
    const user = await createUser();
    const account = await createAccountWithOpening({
      owner: user,
      openingBalance: 5000,
    });

    const { expenseId } = await createPersonalExpense({
      user,
      account,
      amount: 500,
    });
    expect((await Account.findById(account._id))!.cachedBalance).toBe(4500);

    const { incomeId } = await createPersonalIncome({
      user,
      account,
      amount: 200,
    });
    expect((await Account.findById(account._id))!.cachedBalance).toBe(4700);

    await withOptionalTransaction(async (session) => {
      await reverseLedgerEntriesForSource({
        sourceType: "expense",
        sourceId: expenseId,
        session,
      });
      const newTx = await postLedgerEntry({
        accountId: account._id,
        userId: user._id,
        entryType: "debit",
        amount: 300,
        sourceType: "expense",
        sourceId: expenseId,
        description: "Edited",
        session,
      });
      await Expense.findByIdAndUpdate(
        expenseId,
        { amount: 300, transactionId: newTx._id },
        session ? { session } : undefined,
      );
    });

    expect((await Account.findById(account._id))!.cachedBalance).toBe(4900);

    await withOptionalTransaction(async (session) => {
      await reverseLedgerEntriesForSource({
        sourceType: "expense",
        sourceId: expenseId,
        session,
      });
      await Expense.deleteOne(
        { _id: expenseId },
        session ? { session } : undefined,
      );
    });

    await withOptionalTransaction(async (session) => {
      await reverseLedgerEntriesForSource({
        sourceType: "income",
        sourceId: incomeId,
        session,
      });
      const { Income } = await import("@/models/Income");
      await Income.deleteOne(
        { _id: incomeId },
        session ? { session } : undefined,
      );
    });

    expect((await Account.findById(account._id))!.cachedBalance).toBe(5000);
    await assertNoBalanceDrift();
    await assertNoOrphanTransactions();
  });
});

describe("group expenses, transfers, claim", () => {
  beforeAll(async () => {
    await startTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  it("equal group expense debit + delete restores after negative", async () => {
    const alice = await createUser({ email: "alice@ex.com", name: "Alice" });
    const bob = await createUser({ email: "bob@ex.com", name: "Bob" });
    const account = await createAccountWithOpening({
      owner: alice,
      openingBalance: 100,
    });
    const { group, adminMember, otherMember } = await createGroupWithMembers({
      admin: alice,
      otherRegistered: bob,
    });

    const expense = await createEqualGroupExpense({
      group,
      payerMember: adminMember,
      payerAccount: account,
      participantIds: [
        adminMember._id.toString(),
        otherMember!._id.toString(),
      ],
      amount: 500,
      createdBy: alice,
    });

    expect((await Account.findById(account._id))!.cachedBalance).toBe(-400);

    await deleteGroupExpense({ group, expense });
    expect((await Account.findById(account._id))!.cachedBalance).toBe(100);
    await assertNoBalanceDrift();
    await assertNoOrphanTransactions();
  });

  it("edit payer from registered to guest removes ledger debit", async () => {
    const alice = await createUser({ email: "alice2@ex.com", name: "Alice" });
    const bob = await createUser({ email: "bob2@ex.com", name: "Bob" });
    const account = await createAccountWithOpening({
      owner: alice,
      openingBalance: 2000,
    });
    const { group, adminMember, otherMember, guestMember } =
      await createGroupWithMembers({
        admin: alice,
        otherRegistered: bob,
        guestEmail: "guest@ex.com",
        guestName: "Guest",
      });

    const expense = await createEqualGroupExpense({
      group,
      payerMember: adminMember,
      payerAccount: account,
      participantIds: [
        adminMember._id.toString(),
        otherMember!._id.toString(),
        guestMember!._id.toString(),
      ],
      amount: 900,
      createdBy: alice,
    });

    expect((await Account.findById(account._id))!.cachedBalance).toBe(1100);

    await updateGroupExpense({
      group,
      expense,
      data: {
        description: "Guest paid",
        amount: 900,
        splitType: "equal",
        payerMemberId: guestMember!._id.toString(),
        payerAccountId: null,
        participantMemberIds: [
          adminMember._id.toString(),
          otherMember!._id.toString(),
          guestMember!._id.toString(),
        ],
        occurredAt: new Date(),
      },
    });

    expect((await Account.findById(account._id))!.cachedBalance).toBe(2000);
    expect(
      await Transaction.countDocuments({
        sourceType: "group_expense",
        sourceId: expense._id,
      }),
    ).toBe(0);
    await assertNoBalanceDrift();
    await assertNoOrphanTransactions();
  });

  it("pending transfer is ledger no-op; confirm posts both sides", async () => {
    const alice = await createUser({ email: "a3@ex.com", name: "Alice" });
    const bob = await createUser({ email: "b3@ex.com", name: "Bob" });
    const aliceAccount = await createAccountWithOpening({
      owner: alice,
      openingBalance: 5000,
    });
    const bobAccount = await createAccountWithOpening({
      owner: bob,
      openingBalance: 1000,
    });
    const { group, adminMember, otherMember } = await createGroupWithMembers({
      admin: alice,
      otherRegistered: bob,
    });

    const transfer = await GroupTransfer.create({
      group: group._id,
      fromMember: otherMember!._id,
      toMember: adminMember._id,
      fromAccount: bobAccount._id,
      toAccount: aliceAccount._id,
      amount: 250,
      currency: "PKR",
      status: "pending",
      createdBy: bob._id,
    });

    expect(await Transaction.countDocuments({ sourceId: transfer._id })).toBe(
      0,
    );
    expect((await Account.findById(aliceAccount._id))!.cachedBalance).toBe(
      5000,
    );
    expect((await Account.findById(bobAccount._id))!.cachedBalance).toBe(1000);

    transfer.status = "confirmed";
    transfer.resolvedBy = alice._id;
    transfer.resolvedAt = new Date();
    await transfer.save();

    await withTransaction(async (session) => {
      await applyGroupTransferLedger({
        transfer,
        group,
        fromMember: otherMember!,
        toMember: adminMember,
        session,
      });
    });

    expect((await Account.findById(bobAccount._id))!.cachedBalance).toBe(750);
    expect((await Account.findById(aliceAccount._id))!.cachedBalance).toBe(
      5250,
    );
    expect(await Transaction.countDocuments({ sourceId: transfer._id })).toBe(
      2,
    );
    await assertNoBalanceDrift();
  });

  it("guest auto_confirmed transfer only posts registered legs", async () => {
    const alice = await createUser({ email: "a4@ex.com", name: "Alice" });
    const aliceAccount = await createAccountWithOpening({
      owner: alice,
      openingBalance: 3000,
    });
    const { group, adminMember, guestMember } = await createGroupWithMembers({
      admin: alice,
      guestEmail: "payee-guest@ex.com",
    });

    const transfer = await GroupTransfer.create({
      group: group._id,
      fromMember: adminMember._id,
      toMember: guestMember!._id,
      fromAccount: aliceAccount._id,
      toAccount: null,
      amount: 100,
      currency: "PKR",
      status: "auto_confirmed",
      createdBy: alice._id,
      resolvedAt: new Date(),
    });

    await withTransaction(async (session) => {
      await applyGroupTransferLedger({
        transfer,
        group,
        fromMember: adminMember,
        toMember: guestMember!,
        session,
      });
    });

    expect((await Account.findById(aliceAccount._id))!.cachedBalance).toBe(
      2900,
    );
    expect(await Transaction.countDocuments({ sourceId: transfer._id })).toBe(
      1,
    );
  });

  it("reject then recreate another transfer works", async () => {
    const alice = await createUser({ email: "a5@ex.com" });
    const bob = await createUser({ email: "b5@ex.com" });
    const bobAccount = await createAccountWithOpening({
      owner: bob,
      openingBalance: 2000,
    });
    const aliceAccount = await createAccountWithOpening({
      owner: alice,
      openingBalance: 2000,
    });
    const { group, adminMember, otherMember } = await createGroupWithMembers({
      admin: alice,
      otherRegistered: bob,
    });

    const rejected = await GroupTransfer.create({
      group: group._id,
      fromMember: otherMember!._id,
      toMember: adminMember._id,
      fromAccount: bobAccount._id,
      toAccount: aliceAccount._id,
      amount: 50,
      currency: "PKR",
      status: "rejected",
      createdBy: bob._id,
      resolvedBy: alice._id,
      resolvedAt: new Date(),
    });

    expect(await Transaction.countDocuments({ sourceId: rejected._id })).toBe(
      0,
    );

    const next = await GroupTransfer.create({
      group: group._id,
      fromMember: otherMember!._id,
      toMember: adminMember._id,
      fromAccount: bobAccount._id,
      toAccount: aliceAccount._id,
      amount: 75,
      currency: "PKR",
      status: "confirmed",
      createdBy: bob._id,
      resolvedBy: alice._id,
      resolvedAt: new Date(),
    });

    await withTransaction(async (session) => {
      await applyGroupTransferLedger({
        transfer: next,
        group,
        fromMember: otherMember!,
        toMember: adminMember,
        session,
      });
    });

    expect((await Account.findById(bobAccount._id))!.cachedBalance).toBe(1925);
    await assertNoBalanceDrift();
  });

  it("claim guest preserves GroupMember._id", async () => {
    const alice = await createUser({ email: "admin6@ex.com" });
    const { group, guestMember } = await createGroupWithMembers({
      admin: alice,
      guestEmail: "claimer@ex.com",
      guestName: "Soon Registered",
    });

    const guestId = guestMember!._id.toString();
    const expense = await createEqualGroupExpense({
      group,
      payerMember: guestMember!,
      payerAccount: null,
      participantIds: [
        (await GroupMember.findOne({ group: group._id, role: "admin" }))!._id.toString(),
        guestId,
      ],
      amount: 400,
      createdBy: alice,
    });

    expect(expense.payerMember.toString()).toBe(guestId);

    const claimer = await createUser({
      email: "claimer@ex.com",
      name: "Claimer",
    });

    const result = await claimGuestMembershipsForUser(claimer, null);
    expect(result.claimed).toHaveLength(1);
    expect(result.claimed[0]!.memberId).toBe(guestId);

    const member = await GroupMember.findById(guestId);
    expect(member?.memberType).toBe("registered");
    expect(member?.user?.toString()).toBe(claimer._id.toString());

    const count = await GroupMember.countDocuments({
      group: group._id,
      email: "claimer@ex.com",
    });
    expect(count).toBe(1);

    const refreshedExpense = await (
      await import("@/models/GroupExpense")
    ).GroupExpense.findById(expense._id);
    expect(refreshedExpense?.payerMember.toString()).toBe(guestId);
  });

  it("opening-only account can be deleted with reverse", async () => {
    const user = await createUser();
    const account = await createAccountWithOpening({
      owner: user,
      openingBalance: 1234,
    });
    const policy = await getAccountDeletePolicy(account._id);
    expect(policy.canDelete).toBe(true);
    if (policy.canDelete) {
      expect(policy.reverseOpeningBalance).toBe(true);
    }

    await withOptionalTransaction(async (session) => {
      await reverseLedgerEntriesForSource({
        sourceType: "opening_balance",
        sourceId: account._id,
        session,
      });
      await account.deleteOne(session ? { session } : undefined);
    });

    expect(await Account.findById(account._id)).toBeNull();
    await assertNoOrphanTransactions();
  });

  it("detects orphan when expense deleted without reverse", async () => {
    const user = await createUser();
    const account = await createAccountWithOpening({ owner: user });
    const { expenseId } = await createPersonalExpense({
      user,
      account,
      amount: 10,
    });
    await Expense.deleteOne({ _id: expenseId });

    const orphans = await findOrphanTransactions();
    expect(orphans.some((o) => o.sourceId === expenseId)).toBe(true);

    const report = await runLedgerAudit();
    expect(report.ok).toBe(false);
  });
});

describe("authz IDOR helpers", () => {
  beforeAll(async () => {
    await startTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  it("findOwnedAccount hides other users' accounts", async () => {
    const alice = await createUser({ email: "idor-a@ex.com" });
    const bob = await createUser({ email: "idor-b@ex.com" });
    const account = await createAccountWithOpening({ owner: alice });

    expect(
      await findOwnedAccount(bob._id.toString(), account._id.toString()),
    ).toBeNull();
    expect(
      await findOwnedAccount(alice._id.toString(), account._id.toString()),
    ).not.toBeNull();
  });

  it("findGroupMembership rejects non-members", async () => {
    const alice = await createUser({ email: "idor-g1@ex.com" });
    const bob = await createUser({ email: "idor-g2@ex.com" });
    const { group } = await createGroupWithMembers({ admin: alice });

    expect(
      await findGroupMembership(bob._id.toString(), group._id.toString()),
    ).toBeNull();
  });

  it("notifications scoped to owner", async () => {
    const alice = await createUser({ email: "idor-n1@ex.com" });
    const bob = await createUser({ email: "idor-n2@ex.com" });
    const note = await createNotificationFor({ user: alice });

    const stolen = await Notification.findOne({
      _id: note._id,
      user: bob._id,
    });
    expect(stolen).toBeNull();

    const owned = await Notification.findOne({
      _id: note._id,
      user: alice._id,
    });
    expect(owned).not.toBeNull();
  });
});

describe("concurrency", () => {
  beforeAll(async () => {
    await startTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  it("two parallel expenses both land; cache = start − a − b", async () => {
    const user = await createUser();
    const account = await createAccountWithOpening({
      owner: user,
      openingBalance: 1000,
    });

    await Promise.all([
      createPersonalExpense({ user, account, amount: 100, description: "A" }),
      createPersonalExpense({ user, account, amount: 200, description: "B" }),
    ]);

    const refreshed = await Account.findById(account._id);
    expect(refreshed?.cachedBalance).toBe(700);
    expect(await Transaction.countDocuments({ account: account._id })).toBe(3);
    await assertAccountBalanceMatchesLedger(account._id);
    await assertNoBalanceDrift();
    await assertNoOrphanTransactions();
  });
});
