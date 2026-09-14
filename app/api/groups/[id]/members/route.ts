import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  assertGroupAdmin,
  assertGroupMember,
  GroupAccessError,
  groupAccessErrorResponse,
  listMembersForGroup,
} from "@/lib/group-access";
import { issueAndSendGuestInvite } from "@/lib/invite";
import { formatZodErrors } from "@/lib/validators/group";
import { addGroupMemberSchema } from "@/lib/validators/group-member";
import { GroupMember, toGroupMemberPublic } from "@/models/GroupMember";
import { User } from "@/models/User";

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

  const { id } = await context.params;

  try {
    await assertGroupMember(auth.userId, id);
    const members = await listMembersForGroup(id);

    return NextResponse.json({
      members: members.map(toGroupMemberPublic),
    });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    console.error("List group members error:", error);
    return NextResponse.json(
      { error: "Unable to fetch members" },
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

  const parsed = addGroupMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: formatZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  const email = parsed.data.email;
  const requestedRole = parsed.data.role ?? "member";

  try {
    await assertGroupAdmin(auth.userId, groupId);
    await connectDB();

    const existing = await GroupMember.findOne({ group: groupId, email });
    if (existing) {
      return NextResponse.json(
        {
          error: "This email is already in the group.",
          code: "MEMBER_EXISTS",
        },
        { status: 409 },
      );
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser._id.toString() === auth.userId) {
        return NextResponse.json(
          {
            error: "You are already a member of this group.",
            code: "MEMBER_EXISTS",
          },
          { status: 409 },
        );
      }

      const existingByUser = await GroupMember.findOne({
        group: groupId,
        user: existingUser._id,
      });
      if (existingByUser) {
        return NextResponse.json(
          {
            error: "This user is already in the group.",
            code: "MEMBER_EXISTS",
          },
          { status: 409 },
        );
      }

      const member = await GroupMember.create({
        group: groupId,
        user: existingUser._id,
        memberType: "registered",
        displayName: existingUser.name,
        email: existingUser.email.toLowerCase(),
        role: requestedRole,
        inviteTokenHash: null,
        inviteSentAt: null,
        inviteExpiresAt: null,
        claimedAt: null,
      });

      return NextResponse.json(
        { member: toGroupMemberPublic(member), inviteSent: false },
        { status: 201 },
      );
    }

    const displayName = parsed.data.displayName?.trim();
    if (!displayName) {
      return NextResponse.json(
        {
          error: "Validation failed",
          fields: {
            displayName: "Name is required when adding a guest",
          },
        },
        { status: 400 },
      );
    }

    const member = await GroupMember.create({
      group: new mongoose.Types.ObjectId(groupId),
      user: null,
      memberType: "guest",
      displayName,
      email,
      role: requestedRole,
      inviteTokenHash: null,
      inviteSentAt: null,
      inviteExpiresAt: null,
      claimedAt: null,
    });

    const invite = await issueAndSendGuestInvite({
      member,
      inviterUserId: auth.userId,
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

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        {
          error: "This email is already in the group.",
          code: "MEMBER_EXISTS",
        },
        { status: 409 },
      );
    }

    console.error("Add group member error:", error);
    return NextResponse.json(
      { error: "Unable to add member" },
      { status: 500 },
    );
  }
}
