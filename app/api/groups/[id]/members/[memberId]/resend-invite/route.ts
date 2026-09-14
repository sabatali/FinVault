import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  assertGroupAdmin,
  GroupAccessError,
  groupAccessErrorResponse,
} from "@/lib/group-access";
import { canResendInvite, issueAndSendGuestInvite } from "@/lib/invite";
import { GroupMember, toGroupMemberPublic } from "@/models/GroupMember";

type RouteContext = { params: Promise<{ id: string; memberId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId, memberId } = await context.params;

  if (!mongoose.isValidObjectId(memberId)) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  try {
    await assertGroupAdmin(auth.userId, groupId);
    await connectDB();

    const member = await GroupMember.findOne({
      _id: memberId,
      group: groupId,
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (member.memberType !== "guest") {
      return NextResponse.json(
        {
          error: "Invite emails are only for guests.",
          code: "NOT_A_GUEST",
        },
        { status: 400 },
      );
    }

    const cooldown = canResendInvite(member);
    if (!cooldown.allowed) {
      return NextResponse.json(
        {
          error: `Please wait ${cooldown.retryAfterSeconds}s before resending.`,
          code: "RESEND_COOLDOWN",
          retryAfterSeconds: cooldown.retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    const invite = await issueAndSendGuestInvite({
      member,
      inviterUserId: auth.userId,
      regenerate: true,
    });

    const responseBody: Record<string, unknown> = {
      member: toGroupMemberPublic(invite.member),
      inviteSent: invite.inviteSent,
    };

    if (invite.warning) {
      responseBody.inviteWarning = invite.warning;
    }

    if (process.env.NODE_ENV === "development" && invite.inviteUrl) {
      responseBody.devInviteUrl = invite.inviteUrl;
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    console.error("Resend guest invite error:", error);
    return NextResponse.json(
      { error: "Unable to resend invite" },
      { status: 500 },
    );
  }
}
