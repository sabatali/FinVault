import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { assertGroupMember } from "@/lib/group-access";
import {
  TransferStateError,
  transferErrorResponse,
} from "@/lib/group-transfer-errors";
import { GroupTransfer } from "@/models/GroupTransfer";

type RouteContext = { params: Promise<{ id: string; tid: string }> };

/** Sender cancels a pending settlement (deletes the document). */
export async function DELETE(request: NextRequest, context: RouteContext) {
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

    if (transfer.fromMember.toString() !== membership._id.toString()) {
      return NextResponse.json(
        {
          error: "Only the sender can cancel this settlement.",
          code: "SENDER_ONLY",
        },
        { status: 403 },
      );
    }

    const deleted = await GroupTransfer.findOneAndDelete({
      _id: tid,
      group: groupId,
      status: "pending",
      fromMember: membership._id,
    });

    if (!deleted) {
      throw new TransferStateError(
        409,
        "ALREADY_CLOSED",
        "Only pending settlements can be cancelled.",
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = transferErrorResponse(error);
    if (mapped) {
      return mapped;
    }

    console.error("Cancel group transfer error:", error);
    return NextResponse.json(
      { error: "Unable to cancel settlement" },
      { status: 500 },
    );
  }
}
