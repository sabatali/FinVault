import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  assertGroupAdmin,
  countGroupAdmins,
  GroupAccessError,
  groupAccessErrorResponse,
  memberActivityCounts,
} from "@/lib/group-access";
import { formatZodErrors } from "@/lib/validators/group";
import { updateGroupMemberRoleSchema } from "@/lib/validators/group-member";
import { GroupMember, toGroupMemberPublic } from "@/models/GroupMember";
import { GroupMemberAccount } from "@/models/GroupMemberAccount";

type RouteContext = { params: Promise<{ id: string; memberId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId, memberId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateGroupMemberRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: formatZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

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

    const nextRole = parsed.data.role;
    if (member.role === "admin" && nextRole === "member") {
      const adminCount = await countGroupAdmins(groupId);
      if (adminCount <= 1) {
        return NextResponse.json(
          {
            error: "Cannot demote the last admin.",
            code: "LAST_ADMIN",
          },
          { status: 409 },
        );
      }
    }

    member.role = nextRole;
    await member.save();

    return NextResponse.json({ member: toGroupMemberPublic(member) });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    console.error("Update group member role error:", error);
    return NextResponse.json(
      { error: "Unable to update member role" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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

    if (member.role === "admin") {
      const adminCount = await countGroupAdmins(groupId);
      if (adminCount <= 1) {
        return NextResponse.json(
          {
            error: "Cannot remove the last admin.",
            code: "LAST_ADMIN",
          },
          { status: 409 },
        );
      }
    }

    const activity = await memberActivityCounts(member._id);
    if (activity.expenses > 0 || activity.transfers > 0) {
      return NextResponse.json(
        {
          error: "This member has group activity and cannot be removed.",
          code: "MEMBER_HAS_ACTIVITY",
          details: activity,
        },
        { status: 409 },
      );
    }

    await GroupMemberAccount.deleteMany({
      group: groupId,
      groupMember: member._id,
    });
    await member.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    console.error("Remove group member error:", error);
    return NextResponse.json(
      { error: "Unable to remove member" },
      { status: 500 },
    );
  }
}
