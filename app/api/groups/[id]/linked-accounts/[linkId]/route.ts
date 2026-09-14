import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  assertGroupMember,
  GroupAccessError,
  groupAccessErrorResponse,
} from "@/lib/group-access";
import { GroupMemberAccount } from "@/models/GroupMemberAccount";

type RouteContext = { params: Promise<{ id: string; linkId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId, linkId } = await context.params;

  if (!mongoose.isValidObjectId(linkId)) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  try {
    const { membership } = await assertGroupMember(auth.userId, groupId);
    await connectDB();

    const link = await GroupMemberAccount.findOne({
      _id: linkId,
      group: groupId,
      groupMember: membership._id,
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const wasPrimary = link.isPrimary;
    await link.deleteOne();

    if (wasPrimary) {
      const nextPrimary = await GroupMemberAccount.findOne({
        groupMember: membership._id,
        group: groupId,
      }).sort({ createdAt: 1 });

      if (nextPrimary) {
        nextPrimary.isPrimary = true;
        await nextPrimary.save();
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    console.error("Unlink group account error:", error);
    return NextResponse.json(
      { error: "Unable to unlink account" },
      { status: 500 },
    );
  }
}
