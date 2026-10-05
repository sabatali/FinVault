import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { AUTH_COOKIE_NAME, signToken } from "@/lib/jwt";
import { assertAccountBalanceMatchesLedger } from "@/lib/ledger";
import { DELETE as unlinkAccount } from "@/app/api/groups/[id]/linked-accounts/[linkId]/route";
import { POST as confirmTransfer } from "@/app/api/groups/[id]/transfers/[tid]/confirm/route";
import { DELETE as cancelTransfer } from "@/app/api/groups/[id]/transfers/[tid]/route";
import { GroupMemberAccount } from "@/models/GroupMemberAccount";
import { GroupTransfer } from "@/models/GroupTransfer";
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

process.env.JWT_SECRET ??= "test-jwt-secret-for-finvault-tests";

async function authedRequest(
  user: { _id: { toString(): string }; email: string },
  url: string,
  init?: { method?: string; body?: unknown },
) {
  const token = await signToken({
    userId: user._id.toString(),
    email: user.email,
  });
  const headers = new Headers();
  headers.set("cookie", `${AUTH_COOKIE_NAME}=${token}`);
  if (init?.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  return new NextRequest(url, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

describe("settlement unlink and confirm guards", () => {
  beforeAll(async () => {
    await startTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  it("blocks unlink while a pending transfer uses the account, then allows after cancel", async () => {
    const alice = await createUser({ email: "alice@ex.com", name: "Alice" });
    const bob = await createUser({ email: "bob@ex.com", name: "Bob" });
    const aliceAccount = await createAccountWithOpening({ owner: alice });
    const { group, adminMember, otherMember } = await createGroupWithMembers({
      admin: alice,
      otherRegistered: bob,
    });
    const link = await linkMemberAccount({
      group,
      member: adminMember,
      account: aliceAccount,
    });

    const transfer = await GroupTransfer.create({
      group: group._id,
      fromMember: adminMember._id,
      toMember: otherMember!._id,
      fromAccount: aliceAccount._id,
      toAccount: null,
      amount: 100,
      currency: "PKR",
      status: "pending",
      createdBy: alice._id,
    });

    const blocked = await unlinkAccount(
      await authedRequest(
        alice,
        `http://localhost/api/groups/${group._id}/linked-accounts/${link._id}`,
        { method: "DELETE" },
      ),
      { params: Promise.resolve({ id: group._id.toString(), linkId: link._id.toString() }) },
    );
    expect(blocked.status).toBe(409);
    const blockedBody = (await blocked.json()) as { code?: string };
    expect(blockedBody.code).toBe("ACCOUNT_HAS_PENDING_SETTLEMENTS");

    const cancelled = await cancelTransfer(
      await authedRequest(
        alice,
        `http://localhost/api/groups/${group._id}/transfers/${transfer._id}`,
        { method: "DELETE" },
      ),
      { params: Promise.resolve({ id: group._id.toString(), tid: transfer._id.toString() }) },
    );
    expect(cancelled.status).toBe(200);

    const unlinked = await unlinkAccount(
      await authedRequest(
        alice,
        `http://localhost/api/groups/${group._id}/linked-accounts/${link._id}`,
        { method: "DELETE" },
      ),
      { params: Promise.resolve({ id: group._id.toString(), linkId: link._id.toString() }) },
    );
    expect(unlinked.status).toBe(200);
  });

  it("rejects confirm when the sender account is no longer linked", async () => {
    const alice = await createUser({ email: "alice2@ex.com" });
    const bob = await createUser({ email: "bob2@ex.com" });
    const aliceAccount = await createAccountWithOpening({ owner: alice });
    const bobAccount = await createAccountWithOpening({ owner: bob });
    const { group, adminMember, otherMember } = await createGroupWithMembers({
      admin: alice,
      otherRegistered: bob,
    });
    const aliceLink = await linkMemberAccount({
      group,
      member: adminMember,
      account: aliceAccount,
    });
    await linkMemberAccount({
      group,
      member: otherMember!,
      account: bobAccount,
    });

    const transfer = await GroupTransfer.create({
      group: group._id,
      fromMember: adminMember._id,
      toMember: otherMember!._id,
      fromAccount: aliceAccount._id,
      toAccount: null,
      amount: 80,
      currency: "PKR",
      status: "pending",
      createdBy: alice._id,
    });

    await GroupMemberAccount.deleteOne({ _id: aliceLink._id });

    const response = await confirmTransfer(
      await authedRequest(
        bob,
        `http://localhost/api/groups/${group._id}/transfers/${transfer._id}/confirm`,
        { method: "POST", body: { toAccountId: bobAccount._id.toString() } },
      ),
      { params: Promise.resolve({ id: group._id.toString(), tid: transfer._id.toString() }) },
    );

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("SENDER_ACCOUNT_UNAVAILABLE");
    expect((await GroupTransfer.findById(transfer._id))!.status).toBe("pending");
    expect(await Transaction.countDocuments({ sourceId: transfer._id })).toBe(0);
  });

  it("only one of two concurrent confirms succeeds", async () => {
    const alice = await createUser({ email: "alice3@ex.com" });
    const bob = await createUser({ email: "bob3@ex.com" });
    const aliceAccount = await createAccountWithOpening({
      owner: alice,
      openingBalance: 2000,
    });
    const bobAccount = await createAccountWithOpening({
      owner: bob,
      openingBalance: 2000,
    });
    const { group, adminMember, otherMember } = await createGroupWithMembers({
      admin: alice,
      otherRegistered: bob,
    });
    await linkMemberAccount({
      group,
      member: adminMember,
      account: aliceAccount,
    });
    await linkMemberAccount({
      group,
      member: otherMember!,
      account: bobAccount,
    });

    const transfer = await GroupTransfer.create({
      group: group._id,
      fromMember: adminMember._id,
      toMember: otherMember!._id,
      fromAccount: aliceAccount._id,
      toAccount: null,
      amount: 150,
      currency: "PKR",
      status: "pending",
      createdBy: alice._id,
    });

    const params = {
      params: Promise.resolve({
        id: group._id.toString(),
        tid: transfer._id.toString(),
      }),
    };
    const [first, second] = await Promise.all([
      confirmTransfer(
        await authedRequest(
          bob,
          `http://localhost/api/groups/${group._id}/transfers/${transfer._id}/confirm`,
          { method: "POST", body: { toAccountId: bobAccount._id.toString() } },
        ),
        params,
      ),
      confirmTransfer(
        await authedRequest(
          bob,
          `http://localhost/api/groups/${group._id}/transfers/${transfer._id}/confirm`,
          { method: "POST", body: { toAccountId: bobAccount._id.toString() } },
        ),
        params,
      ),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const bodies = await Promise.all([first.json(), second.json()]);
    const failed = bodies.find((row) => row.code === "NOT_PENDING");
    expect(failed).toBeTruthy();

    expect(await Transaction.countDocuments({ sourceId: transfer._id })).toBe(2);
    await assertAccountBalanceMatchesLedger(aliceAccount._id);
    await assertAccountBalanceMatchesLedger(bobAccount._id);
  });
});
