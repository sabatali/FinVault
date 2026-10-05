import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  assertGroupMember,
} from "@/lib/group-access";
import { transferErrorResponse } from "@/lib/group-transfer-errors";
import { withTransaction } from "@/lib/with-transaction";
import { GroupMemberAccount } from "@/models/GroupMemberAccount";
import { GroupTransfer } from "@/models/GroupTransfer";

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

    const pending = await GroupTransfer.countDocuments({
      group: groupId,
      status: "pending",
      $or: [{ fromAccount: link.account }, { toAccount: link.account }],
    });

    if (pending > 0) {
      return NextResponse.json(
        {
          error:
            "This account is used by a pending settlement. Cancel or resolve it first.",
          code: "ACCOUNT_HAS_PENDING_SETTLEMENTS",
          pendingCount: pending,
        },
        { status: 409 },
      );
    }

    await withTransaction(async (session) => {
      const wasPrimary = link.isPrimary;
      await link.deleteOne({ session });

      if (wasPrimary) {
        const nextPrimary = await GroupMemberAccount.findOne({
          groupMember: membership._id,
          group: groupId,
        })
          .sort({ createdAt: 1 })
          .session(session);

        if (nextPrimary) {
          nextPrimary.isPrimary = true;
          await nextPrimary.save({ session });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = transferErrorResponse(error);
    if (mapped) {
      return mapped;
    }

    console.error("Unlink group account error:", error);
    return NextResponse.json(
      { error: "Unable to unlink account" },
      { status: 500 },
    );
  }
}
