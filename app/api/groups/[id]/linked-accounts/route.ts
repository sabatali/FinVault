import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  assertGroupMember,
  GroupAccessError,
  groupAccessErrorResponse,
} from "@/lib/group-access";
import { formatZodErrors } from "@/lib/validators/group";
import { linkGroupAccountSchema } from "@/lib/validators/group-member-account";
import { Account } from "@/models/Account";
import {
  GroupMemberAccount,
  toGroupMemberAccountPublic,
} from "@/models/GroupMemberAccount";

type RouteContext = { params: Promise<{ id: string }> };

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId } = await context.params;

  try {
    const { membership } = await assertGroupMember(auth.userId, groupId);

    if (membership.memberType !== "registered") {
      return NextResponse.json(
        {
          error: "Guests cannot link accounts.",
          code: "GUEST_CANNOT_LINK_ACCOUNT",
        },
        { status: 400 },
      );
    }

    await connectDB();

    const links = await GroupMemberAccount.find({
      group: groupId,
      groupMember: membership._id,
    }).sort({ isPrimary: -1, createdAt: 1 });

    const accountIds = links.map((link) => link.account);
    const accounts = await Account.find({
      _id: { $in: accountIds },
      owner: auth.userId,
    });
    const accountMap = new Map(
      accounts.map((account) => [account._id.toString(), account]),
    );

    const linkedAccounts = [];
    let primaryAccountId: string | null = null;
    for (const link of links) {
      const account = accountMap.get(link.account.toString());
      if (account) {
        linkedAccounts.push(toGroupMemberAccountPublic(link, account));
        if (link.isPrimary) {
          primaryAccountId = account._id.toString();
        }
      }
    }

    return NextResponse.json({ linkedAccounts, primaryAccountId });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    console.error("List linked accounts error:", error);
    return NextResponse.json(
      { error: "Unable to fetch linked accounts" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = linkGroupAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: formatZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  const { accountId } = parsed.data;

  try {
    const { membership } = await assertGroupMember(auth.userId, groupId);

    if (membership.memberType !== "registered" || !membership.user) {
      return NextResponse.json(
        {
          error: "Guests cannot link accounts.",
          code: "GUEST_CANNOT_LINK_ACCOUNT",
        },
        { status: 400 },
      );
    }

    await connectDB();

    const account = await Account.findOne({
      _id: accountId,
      owner: auth.userId,
    });

    if (!account) {
      return NextResponse.json(
        {
          error: "Account not found.",
          code: "ACCOUNT_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    if (account.currency !== "PKR") {
      return NextResponse.json(
        {
          error: "Only PKR accounts can be linked until multi-currency support.",
          code: "CURRENCY_NOT_SUPPORTED",
        },
        { status: 400 },
      );
    }

    const existing = await GroupMemberAccount.findOne({
      group: groupId,
      account: accountId,
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "This account is already linked to the group.",
          code: "ACCOUNT_ALREADY_LINKED",
        },
        { status: 409 },
      );
    }

    const existingPrimary = await GroupMemberAccount.findOne({
      groupMember: membership._id,
      group: groupId,
      isPrimary: true,
    });
    const isPrimary = !existingPrimary;

    const link = await GroupMemberAccount.create({
      group: new mongoose.Types.ObjectId(groupId),
      groupMember: membership._id,
      account: account._id,
      isPrimary,
    });

    return NextResponse.json(
      { linkedAccount: toGroupMemberAccountPublic(link, account) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        {
          error: "This account is already linked to the group.",
          code: "ACCOUNT_ALREADY_LINKED",
        },
        { status: 409 },
      );
    }

    console.error("Link account to group error:", error);
    return NextResponse.json(
      { error: "Unable to link account" },
      { status: 500 },
    );
  }
}
