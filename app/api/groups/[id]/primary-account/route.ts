import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  assertGroupMember,
  GroupAccessError,
  groupAccessErrorResponse,
} from "@/lib/group-access";
import { formatZodErrors } from "@/lib/validators/group";
import { setPrimaryAccountSchema } from "@/lib/validators/group-member-account";
import { withOptionalTransaction } from "@/lib/with-transaction";
import { GroupMemberAccount } from "@/models/GroupMemberAccount";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Sets the current member's default payer account for this group.
 * Phase 5: if payerAccountId is omitted on group expense create, use this primary;
 * if none, respond 400 NO_PAYER_ACCOUNT.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
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

  const parsed = setPrimaryAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: formatZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  try {
    const { membership } = await assertGroupMember(auth.userId, groupId);

    if (membership.memberType !== "registered" || !membership.user) {
      return NextResponse.json(
        {
          error: "Guests cannot set a primary account.",
          code: "GUEST_CANNOT_LINK_ACCOUNT",
        },
        { status: 400 },
      );
    }

    await connectDB();

    const filter =
      parsed.data.linkId != null
        ? {
            _id: parsed.data.linkId,
            group: groupId,
            groupMember: membership._id,
          }
        : {
            group: groupId,
            groupMember: membership._id,
            account: parsed.data.accountId,
          };

    const target = await GroupMemberAccount.findOne(filter);
    if (!target) {
      return NextResponse.json(
        {
          error: "Account is not linked to this group.",
          code: "ACCOUNT_NOT_LINKED",
        },
        { status: 400 },
      );
    }

    if (target.isPrimary) {
      return NextResponse.json({
        primaryAccountId: target.account.toString(),
      });
    }

    await withOptionalTransaction(async (session) => {
      const sessionOpts = session ? { session } : undefined;

      await GroupMemberAccount.updateMany(
        {
          group: groupId,
          groupMember: membership._id,
          isPrimary: true,
        },
        { $set: { isPrimary: false } },
        sessionOpts,
      );

      target.isPrimary = true;
      await target.save(sessionOpts);
    });

    return NextResponse.json({
      primaryAccountId: target.account.toString(),
    });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    console.error("Set primary account error:", error);
    return NextResponse.json(
      { error: "Unable to set primary account" },
      { status: 500 },
    );
  }
}
