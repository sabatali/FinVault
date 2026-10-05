import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { assertGroupMember } from "@/lib/group-access";
import {
  TransferStateError,
  transferErrorResponse,
} from "@/lib/group-transfer-errors";
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

    if (transfer.toMember.toString() !== membership._id.toString()) {
      return NextResponse.json(
        {
          error: "Only the receiver can reject this settlement.",
          code: "RECEIVER_ONLY",
        },
        { status: 403 },
      );
    }

    if (transfer.status === "auto_confirmed") {
      return NextResponse.json(
        {
          error: "Guest settlements are auto-confirmed and cannot be rejected.",
          code: "NOT_PENDING",
        },
        { status: 400 },
      );
    }

    const claimed = await GroupTransfer.findOneAndUpdate(
      {
        _id: tid,
        group: groupId,
        status: "pending",
        toMember: membership._id,
      },
      {
        $set: {
          status: "rejected",
          resolvedBy: new mongoose.Types.ObjectId(auth.userId),
          resolvedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );

    if (!claimed) {
      throw new TransferStateError(
        409,
        "NOT_PENDING",
        "This settlement was already resolved.",
      );
    }

    return NextResponse.json({
      transfer: await buildGroupTransferPublic(claimed),
    });
  } catch (error) {
    const mapped = transferErrorResponse(error);
    if (mapped) {
      return mapped;
    }

    console.error("Reject group transfer error:", error);
    return NextResponse.json(
      { error: "Unable to reject settlement" },
      { status: 500 },
    );
  }
}
