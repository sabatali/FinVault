import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  assertGroupMember,
  GroupAccessError,
  groupAccessErrorResponse,
} from "@/lib/group-access";
import {
  applyGroupTransferLedger,
  transferInvolvesGuest,
} from "@/lib/group-transfer-ledger";
import { buildGroupTransferPublic } from "@/lib/group-transfer-public";
import {
  notifySettlementAutoConfirmed,
  notifySettlementRequested,
} from "@/lib/notify";
import {
  AccountNotFoundError,
  AccountOwnershipError,
  InvalidLedgerAmountError,
} from "@/lib/ledger-errors";
import { roundAmount } from "@/lib/money";
import {
  createGroupTransferSchema,
  formatZodErrors,
} from "@/lib/validators/group-transfer";
import { withOptionalTransaction } from "@/lib/with-transaction";
import { Account } from "@/models/Account";
import { GroupMember, type IGroupMember } from "@/models/GroupMember";
import { GroupMemberAccount } from "@/models/GroupMemberAccount";
import { GroupTransfer } from "@/models/GroupTransfer";

type RouteContext = { params: Promise<{ id: string }> };

async function resolveLinkedAccount(input: {
  groupId: string;
  member: IGroupMember;
  accountId: string;
  /** When set, account must be owned by this user. */
  requireOwnerUserId?: string;
}): Promise<InstanceType<typeof Account>> {
  const link = await GroupMemberAccount.findOne({
    group: input.groupId,
    groupMember: input.member._id,
    account: input.accountId,
  });
  if (!link) {
    throw new ResponseError(
      "Account is not linked to this group.",
      400,
      "ACCOUNT_NOT_LINKED",
    );
  }

  const account = await Account.findById(input.accountId);
  if (!account) {
    throw new ResponseError("Account not found.", 404, "ACCOUNT_NOT_FOUND");
  }

  if (
    input.requireOwnerUserId &&
    account.owner.toString() !== input.requireOwnerUserId
  ) {
    throw new ResponseError("Account not found.", 404, "ACCOUNT_NOT_FOUND");
  }

  if (
    input.member.user &&
    account.owner.toString() !== input.member.user.toString()
  ) {
    throw new ResponseError(
      "Account does not belong to this member.",
      400,
      "ACCOUNT_OWNER_MISMATCH",
    );
  }

  if (account.currency !== "PKR") {
    throw new ResponseError("Only PKR accounts are supported.", 400);
  }

  return account;
}

async function resolvePrimaryLinkedAccount(input: {
  groupId: string;
  member: IGroupMember;
}): Promise<InstanceType<typeof Account> | null> {
  const link =
    (await GroupMemberAccount.findOne({
      group: input.groupId,
      groupMember: input.member._id,
      isPrimary: true,
    })) ??
    (await GroupMemberAccount.findOne({
      group: input.groupId,
      groupMember: input.member._id,
    }).sort({ createdAt: 1 }));

  if (!link) {
    return null;
  }

  const account = await Account.findById(link.account);
  if (!account) {
    return null;
  }
  if (
    input.member.user &&
    account.owner.toString() !== input.member.user.toString()
  ) {
    return null;
  }
  return account;
}

class ResponseError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;

  constructor(
    message: string,
    status: number,
    code?: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ResponseError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId } = await context.params;

  try {
    await assertGroupMember(auth.userId, groupId);
    await connectDB();

    const transfers = await GroupTransfer.find({ group: groupId }).sort({
      createdAt: -1,
    });

    const publicTransfers = await Promise.all(
      transfers.map((transfer) => buildGroupTransferPublic(transfer)),
    );

    return NextResponse.json({ transfers: publicTransfers });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    console.error("List group transfers error:", error);
    return NextResponse.json(
      { error: "Unable to fetch settlements" },
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

  const parsed = createGroupTransferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: formatZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  const amount = roundAmount(parsed.data.amount);
  const toMemberId = parsed.data.toMemberId;

  try {
    const { group, membership: actorMembership } = await assertGroupMember(
      auth.userId,
      groupId,
    );
    await connectDB();

    if (actorMembership.memberType !== "registered" || !actorMembership.user) {
      return NextResponse.json(
        {
          error: "Only registered members can record settlements.",
          code: "REGISTERED_REQUIRED",
        },
        { status: 400 },
      );
    }

    const fromMemberId =
      parsed.data.fromMemberId ?? actorMembership._id.toString();

    if (fromMemberId === toMemberId) {
      return NextResponse.json(
        {
          error: "Cannot settle with yourself.",
          code: "SELF_TRANSFER",
          fields: { toMemberId: "Pick a different member" },
        },
        { status: 400 },
      );
    }

    const [fromMembership, toMembership] = await Promise.all([
      GroupMember.findOne({ _id: fromMemberId, group: groupId }),
      GroupMember.findOne({ _id: toMemberId, group: groupId }),
    ]);

    if (!fromMembership || !toMembership) {
      return NextResponse.json(
        {
          error: "Both members must belong to this group.",
          code: "INVALID_MEMBERS",
        },
        { status: 400 },
      );
    }

    // Both-registered: sender must be the current user (6.1 path).
    const involvesGuest = transferInvolvesGuest(fromMembership, toMembership);
    if (!involvesGuest) {
      if (fromMembership._id.toString() !== actorMembership._id.toString()) {
        return NextResponse.json(
          {
            error: "You can only request settlements from your own membership.",
            code: "SENDER_MUST_BE_SELF",
            fields: { fromMemberId: "Sender must be you for registered pairs" },
          },
          { status: 403 },
        );
      }
    }

    let fromAccountId: mongoose.Types.ObjectId | null = null;
    let toAccountId: mongoose.Types.ObjectId | null = null;

    if (fromMembership.memberType === "registered") {
      if (!parsed.data.fromAccountId) {
        return NextResponse.json(
          {
            error: "Sender account is required for a registered sender.",
            fields: { fromAccountId: "Select a linked account" },
          },
          { status: 400 },
        );
      }
      const fromAccount = await resolveLinkedAccount({
        groupId,
        member: fromMembership,
        accountId: parsed.data.fromAccountId,
        requireOwnerUserId:
          fromMembership._id.toString() === actorMembership._id.toString()
            ? auth.userId
            : undefined,
      });
      fromAccountId = fromAccount._id;
    }

    if (toMembership.memberType === "registered" && involvesGuest) {
      if (parsed.data.toAccountId) {
        const toAccount = await resolveLinkedAccount({
          groupId,
          member: toMembership,
          accountId: parsed.data.toAccountId,
        });
        toAccountId = toAccount._id;
      } else {
        const primary = await resolvePrimaryLinkedAccount({
          groupId,
          member: toMembership,
        });
        if (!primary) {
          return NextResponse.json(
            {
              error:
                "Receiver has no linked account. Link one before settling to them.",
              code: "NO_PAYER_ACCOUNT",
              fields: { toAccountId: "Receiver needs a linked account" },
            },
            { status: 400 },
          );
        }
        toAccountId = primary._id;
      }
    }

    if (!involvesGuest) {
      const transfer = await GroupTransfer.create({
        group: group._id,
        fromMember: fromMembership._id,
        toMember: toMembership._id,
        fromAccount: fromAccountId,
        toAccount: null,
        amount,
        currency: "PKR",
        status: "pending",
        debitTransactionId: null,
        creditTransactionId: null,
        createdBy: new mongoose.Types.ObjectId(auth.userId),
        resolvedBy: null,
        resolvedAt: null,
      });

      try {
        await notifySettlementRequested({
          group,
          transfer,
          toMember: toMembership,
          actorUserId: auth.userId,
        });
      } catch (error) {
        console.error("Settlement request notification error:", error);
      }

      return NextResponse.json(
        {
          transfer: await buildGroupTransferPublic(transfer),
          autoConfirmed: false,
        },
        { status: 201 },
      );
    }

    const transferId = await withOptionalTransaction(async (session) => {
      const opts = session ? { session } : undefined;
      const newId = new mongoose.Types.ObjectId();

      const docs = await GroupTransfer.create(
        [
          {
            _id: newId,
            group: group._id,
            fromMember: fromMembership._id,
            toMember: toMembership._id,
            fromAccount: fromAccountId,
            toAccount: toAccountId,
            amount,
            currency: "PKR",
            status: "auto_confirmed",
            debitTransactionId: null,
            creditTransactionId: null,
            createdBy: new mongoose.Types.ObjectId(auth.userId),
            resolvedBy: new mongoose.Types.ObjectId(auth.userId),
            resolvedAt: new Date(),
          },
        ],
        opts,
      );

      const transfer = docs[0]!;
      await applyGroupTransferLedger({
        transfer,
        group,
        fromMember: fromMembership,
        toMember: toMembership,
        session,
      });

      return newId;
    });

    const transfer = await GroupTransfer.findById(transferId);

    try {
      await notifySettlementAutoConfirmed({
        group,
        transfer: transfer!,
        fromMember: fromMembership,
        toMember: toMembership,
        actorUserId: auth.userId,
      });
    } catch (error) {
      console.error("Auto-confirm settlement notification error:", error);
    }

    return NextResponse.json(
      {
        transfer: await buildGroupTransferPublic(transfer!),
        autoConfirmed: true,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    if (error instanceof ResponseError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.code ? { code: error.code } : {}),
          ...(error.fields ? { fields: error.fields } : {}),
        },
        { status: error.status },
      );
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

    console.error("Create group transfer error:", error);
    return NextResponse.json(
      { error: "Unable to create settlement" },
      { status: 500 },
    );
  }
}
