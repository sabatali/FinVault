import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  assertGroupMember,
  GroupAccessError,
  groupAccessErrorResponse,
} from "@/lib/group-access";
import { applyGroupTransferLedger } from "@/lib/group-transfer-ledger";
import { buildGroupTransferPublic } from "@/lib/group-transfer-public";
import { notifySettlementConfirmed } from "@/lib/notify";
import {
  AccountNotFoundError,
  AccountOwnershipError,
  InvalidLedgerAmountError,
} from "@/lib/ledger-errors";
import {
  confirmGroupTransferSchema,
  formatZodErrors,
} from "@/lib/validators/group-transfer";
import { withOptionalTransaction } from "@/lib/with-transaction";
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

    const transfer = await GroupTransfer.findOne({
      _id: tid,
      group: groupId,
    });

    if (!transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    if (transfer.status === "rejected") {
      return NextResponse.json(
        {
          error: "This settlement was rejected and cannot be confirmed.",
          code: "ALREADY_REJECTED",
        },
        { status: 409 },
      );
    }

    if (transfer.status !== "pending") {
      return NextResponse.json(
        {
          error:
            transfer.status === "auto_confirmed"
              ? "Guest settlements are auto-confirmed and cannot be confirmed again."
              : "This settlement is not pending.",
          code: "NOT_PENDING",
        },
        { status: 400 },
      );
    }

    if (transfer.toMember.toString() !== membership._id.toString()) {
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

    let toAccountId: mongoose.Types.ObjectId | null = null;

    if (parsed.data.toAccountId) {
      const link = await GroupMemberAccount.findOne({
        group: groupId,
        groupMember: membership._id,
        account: parsed.data.toAccountId,
      });
      if (!link) {
        return NextResponse.json(
          {
            error: "To account is not linked to this group.",
            code: "ACCOUNT_NOT_LINKED",
            fields: { toAccountId: "Link this account first" },
          },
          { status: 400 },
        );
      }
      const account = await Account.findOne({
        _id: parsed.data.toAccountId,
        owner: auth.userId,
      });
      if (!account) {
        return NextResponse.json(
          { error: "To account not found.", code: "ACCOUNT_NOT_FOUND" },
          { status: 404 },
        );
      }
      toAccountId = account._id;
    } else {
      const primary =
        (await GroupMemberAccount.findOne({
          group: groupId,
          groupMember: membership._id,
          isPrimary: true,
        })) ??
        (await GroupMemberAccount.findOne({
          group: groupId,
          groupMember: membership._id,
        }).sort({ createdAt: 1 }));

      if (!primary) {
        return NextResponse.json(
          {
            error: "Link an account before confirming this settlement.",
            code: "NO_PAYER_ACCOUNT",
            fields: { toAccountId: "Link a personal account to this group" },
          },
          { status: 400 },
        );
      }
      toAccountId = primary.account;
    }

    const fromMember = await GroupMember.findById(transfer.fromMember);
    if (!fromMember) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    if (
      fromMember.memberType === "registered" &&
      !transfer.fromAccount
    ) {
      return NextResponse.json(
        {
          error: "Sender account is missing on this settlement.",
          code: "NO_SENDER_ACCOUNT",
        },
        { status: 400 },
      );
    }

    await withOptionalTransaction(async (session) => {
      const opts = session ? { session } : undefined;
      transfer.toAccount = toAccountId;
      transfer.status = "confirmed";
      transfer.resolvedBy = new mongoose.Types.ObjectId(auth.userId);
      transfer.resolvedAt = new Date();
      await transfer.save(opts);

      await applyGroupTransferLedger({
        transfer,
        group,
        fromMember,
        toMember: membership,
        session,
      });
    });

    const refreshed = await GroupTransfer.findById(transfer._id);

    try {
      await notifySettlementConfirmed({
        group,
        transfer: refreshed!,
        fromMember,
        actorUserId: auth.userId,
      });
    } catch (error) {
      console.error("Settlement confirm notification error:", error);
    }

    return NextResponse.json({
      transfer: await buildGroupTransferPublic(refreshed!),
    });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    if (
      error instanceof AccountNotFoundError ||
      error instanceof AccountOwnershipError
    ) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (error instanceof InvalidLedgerAmountError) {
      return NextResponse.json(
        { error: error.message, fields: { amount: error.message } },
        { status: 400 },
      );
    }

    console.error("Confirm group transfer error:", error);
    return NextResponse.json(
      { error: "Unable to confirm settlement" },
      { status: 500 },
    );
  }
}
