import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  assertGroupMember,
} from "@/lib/group-access";
import { applyGroupTransferLedger } from "@/lib/group-transfer-ledger";
import {
  TransferStateError,
  transferErrorResponse,
} from "@/lib/group-transfer-errors";
import { buildGroupTransferPublic } from "@/lib/group-transfer-public";
import { notifySettlementConfirmed } from "@/lib/notify";
import {
  confirmGroupTransferSchema,
  formatZodErrors,
} from "@/lib/validators/group-transfer";
import { withTransaction } from "@/lib/with-transaction";
import { Account } from "@/models/Account";
import { GroupMember } from "@/models/GroupMember";
import { GroupMemberAccount } from "@/models/GroupMemberAccount";
import { GroupTransfer } from "@/models/GroupTransfer";

type RouteContext = { params: Promise<{ id: string; tid: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId, tid } = await context.params;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as unknown;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = confirmGroupTransferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: formatZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  if (!mongoose.isValidObjectId(tid)) {
    return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
  }

  try {
    const { group, membership } = await assertGroupMember(auth.userId, groupId);
    await connectDB();

    const existing = await GroupTransfer.findOne({
      _id: tid,
      group: groupId,
    });

    if (!existing) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    if (existing.status === "rejected") {
      return NextResponse.json(
        {
          error: "This settlement was rejected and cannot be confirmed.",
          code: "ALREADY_REJECTED",
        },
        { status: 409 },
      );
    }

    if (existing.toMember.toString() !== membership._id.toString()) {
      return NextResponse.json(
        {
          error: "Only the receiver can confirm this settlement.",
          code: "RECEIVER_ONLY",
        },
        { status: 403 },
      );
    }

    if (membership.memberType !== "registered" || !membership.user) {
      return NextResponse.json(
        { error: "Receiver must be a registered member." },
        { status: 400 },
      );
    }

    if (existing.status !== "pending") {
      return NextResponse.json(
        {
          error:
            existing.status === "auto_confirmed"
              ? "Guest settlements are auto-confirmed and cannot be confirmed again."
              : "This settlement is not pending.",
          code: "NOT_PENDING",
        },
        { status: existing.status === "auto_confirmed" ? 400 : 409 },
      );
    }

    const requestedToAccountId = parsed.data.toAccountId ?? null;

    await withTransaction(async (session) => {
      let toAccountId: mongoose.Types.ObjectId | null = null;

      if (requestedToAccountId) {
        const link = await GroupMemberAccount.findOne({
          group: groupId,
          groupMember: membership._id,
          account: requestedToAccountId,
        }).session(session);
        if (!link) {
          throw new TransferStateError(
            400,
            "ACCOUNT_NOT_LINKED",
            "To account is not linked to this group.",
          );
        }
        const account = await Account.findOne({
          _id: requestedToAccountId,
          owner: auth.userId,
        }).session(session);
        if (!account) {
          throw new TransferStateError(
            404,
            "ACCOUNT_NOT_FOUND",
            "To account not found.",
          );
        }
        if (account.currency !== "PKR") {
          throw new TransferStateError(
            400,
            "ACCOUNT_CURRENCY",
            "Only PKR accounts are supported.",
          );
        }
        toAccountId = account._id;
      } else {
        const primary =
          (await GroupMemberAccount.findOne({
            group: groupId,
            groupMember: membership._id,
            isPrimary: true,
          }).session(session)) ??
          (await GroupMemberAccount.findOne({
            group: groupId,
            groupMember: membership._id,
          })
            .sort({ createdAt: 1 })
            .session(session));

        if (!primary) {
          throw new TransferStateError(
            400,
            "NO_PAYER_ACCOUNT",
            "Link an account before confirming this settlement.",
          );
        }
        const account = await Account.findById(primary.account).session(
          session,
        );
        if (!account || account.currency !== "PKR") {
          throw new TransferStateError(
            400,
            "ACCOUNT_CURRENCY",
            "Only PKR accounts are supported.",
          );
        }
        toAccountId = account._id;
      }

      const fromMember = await GroupMember.findById(
        existing.fromMember,
      ).session(session);
      if (!fromMember) {
        throw new TransferStateError(404, "NOT_FOUND", "Transfer not found");
      }

      if (fromMember.memberType === "registered") {
        if (!existing.fromAccount) {
          throw new TransferStateError(
            400,
            "NO_SENDER_ACCOUNT",
            "Sender account is missing on this settlement.",
          );
        }

        const senderLink = await GroupMemberAccount.findOne({
          group: groupId,
          groupMember: fromMember._id,
          account: existing.fromAccount,
        }).session(session);
        const senderAccount = await Account.findById(
          existing.fromAccount,
        ).session(session);

        const ownerOk =
          Boolean(fromMember.user) &&
          Boolean(senderAccount) &&
          senderAccount!.owner.toString() === fromMember.user!.toString();

        if (
          !senderLink ||
          !senderAccount ||
          !ownerOk ||
          senderAccount.currency !== "PKR"
        ) {
          throw new TransferStateError(
            409,
            "SENDER_ACCOUNT_UNAVAILABLE",
            "The sender's account is no longer linked to this group. Ask them to cancel and re-send the settlement.",
          );
        }
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
            status: "confirmed",
            toAccount: toAccountId,
            resolvedBy: new mongoose.Types.ObjectId(auth.userId),
            resolvedAt: new Date(),
          },
        },
        { returnDocument: "after", session },
      );

      if (!claimed) {
        throw new TransferStateError(
          409,
          "NOT_PENDING",
          "This settlement was already resolved.",
        );
      }

      await applyGroupTransferLedger({
        transfer: claimed,
        group,
        fromMember,
        toMember: membership,
        session,
      });
    });

    const refreshed = await GroupTransfer.findById(tid);
    const fromMember = await GroupMember.findById(refreshed!.fromMember);

    try {
      await notifySettlementConfirmed({
        group,
        transfer: refreshed!,
        fromMember: fromMember!,
        actorUserId: auth.userId,
      });
    } catch (error) {
      console.error("Settlement confirm notification error:", error);
    }

    return NextResponse.json({
      transfer: await buildGroupTransferPublic(refreshed!),
    });
  } catch (error) {
    const mapped = transferErrorResponse(error);
    if (mapped) {
      return mapped;
    }

    console.error("Confirm group transfer error:", error);
    return NextResponse.json(
      { error: "Unable to confirm settlement" },
      { status: 500 },
    );
  }
}
