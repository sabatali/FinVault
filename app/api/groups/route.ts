import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { listGroupsForUser } from "@/lib/group-access";
import { withOptionalTransaction } from "@/lib/with-transaction";
import {
  createGroupSchema,
  formatZodErrors,
} from "@/lib/validators/group";
import { Group, toGroupPublic } from "@/models/Group";
import { GroupMember } from "@/models/GroupMember";
import { User } from "@/models/User";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const rows = await listGroupsForUser(auth.userId);
    return NextResponse.json({
      groups: rows.map(({ group, role }) => toGroupPublic(group, { role })),
    });
  } catch (error) {
    console.error("List groups error:", error);
    return NextResponse.json(
      { error: "Unable to fetch groups" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: formatZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  const name = parsed.data.name.trim();
  const userId = new mongoose.Types.ObjectId(auth.userId);

  try {
    await connectDB();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = await withOptionalTransaction(async (session) => {
      const newGroupId = new mongoose.Types.ObjectId();
      const createOptions = session ? { session } : undefined;

      await Group.create(
        [
          {
            _id: newGroupId,
            name,
            createdBy: userId,
          },
        ],
        createOptions,
      );

      await GroupMember.create(
        [
          {
            group: newGroupId,
            user: userId,
            memberType: "registered",
            displayName: user.name,
            email: user.email.toLowerCase(),
            role: "admin",
            inviteTokenHash: null,
            inviteSentAt: null,
            inviteExpiresAt: null,
            claimedAt: null,
          },
        ],
        createOptions,
      );

      return newGroupId;
    });

    const group = await Group.findById(groupId);
    if (!group) {
      return NextResponse.json(
        { error: "Unable to create group" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { group: toGroupPublic(group, { role: "admin" }) },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create group error:", error);
    return NextResponse.json(
      { error: "Unable to create group" },
      { status: 500 },
    );
  }
}
