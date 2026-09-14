import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  assertGroupMember,
  GroupAccessError,
  groupAccessErrorResponse,
} from "@/lib/group-access";
import { buildGroupTransferPublic } from "@/lib/group-transfer-public";
import { GroupTransfer } from "@/models/GroupTransfer";

type RouteContext = { params: Promise<{ id: string; tid: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId, tid } = await context.params;

  if (!mongoose.isValidObjectId(tid)) {
    return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
  }

  try {
    const { membership } = await assertGroupMember(auth.userId, groupId);
    await connectDB();

    const transfer = await GroupTransfer.findOne({
      _id: tid,
      group: groupId,
    });

    if (!transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    if (transfer.status !== "pending") {
      return NextResponse.json(
        {
          error:
            transfer.status === "auto_confirmed"
              ? "Guest settlements are auto-confirmed and cannot be rejected."
              : "This settlement is not pending.",
          code: "NOT_PENDING",
        },
        { status: 400 },
      );
    }

    if (transfer.toMember.toString() !== membership._id.toString()) {
      return NextResponse.json(
        {
          error: "Only the receiver can reject this settlement.",
          code: "RECEIVER_ONLY",
        },
        { status: 403 },
      );
    }

    transfer.status = "rejected";
    transfer.resolvedBy = new mongoose.Types.ObjectId(auth.userId);
    transfer.resolvedAt = new Date();
    await transfer.save();

    return NextResponse.json({
      transfer: await buildGroupTransferPublic(transfer),
    });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    console.error("Reject group transfer error:", error);
    return NextResponse.json(
      { error: "Unable to reject settlement" },
      { status: 500 },
    );
  }
}
