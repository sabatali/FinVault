import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { AUTH_COOKIE_NAME, signToken } from "@/lib/jwt";
import { DELETE as removeMember } from "@/app/api/groups/[id]/members/[memberId]/route";
import { GroupTransfer } from "@/models/GroupTransfer";
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

describe("memberHasActivity includes transfers", () => {
  beforeAll(async () => {
    await startTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  it("blocks removing a member who only has a pending transfer", async () => {
    const alice = await createUser({ email: "admin@ex.com" });
    const bob = await createUser({ email: "member@ex.com" });
    const aliceAccount = await createAccountWithOpening({ owner: alice });
    const { group, adminMember, otherMember } = await createGroupWithMembers({
      admin: alice,
      otherRegistered: bob,
    });
    await linkMemberAccount({
      group,
      member: adminMember,
      account: aliceAccount,
    });

    await GroupTransfer.create({
      group: group._id,
      fromMember: otherMember!._id,
      toMember: adminMember._id,
      fromAccount: null,
      toAccount: null,
      amount: 25,
      currency: "PKR",
      status: "pending",
      createdBy: alice._id,
    });

    const token = await signToken({
      userId: alice._id.toString(),
      email: alice.email,
    });
    const request = new NextRequest(
      `http://localhost/api/groups/${group._id}/members/${otherMember!._id}`,
      {
        method: "DELETE",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      },
    );

    const response = await removeMember(request, {
      params: Promise.resolve({
        id: group._id.toString(),
        memberId: otherMember!._id.toString(),
      }),
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      code?: string;
      details?: { expenses: number; transfers: number };
    };
    expect(body.code).toBe("MEMBER_HAS_ACTIVITY");
    expect(body.details?.transfers).toBe(1);
    expect(body.details?.expenses).toBe(0);
  });
});
