import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Settlement transfers between group members (Phase 6).
 * Created here so Feature 5.5 can include confirmed transfers in balances
 * without rewriting the calculator later.
 */
export const GROUP_TRANSFER_STATUSES = [
  "pending",
  "confirmed",
  "rejected",
  "auto_confirmed",
] as const;
export type GroupTransferStatus = (typeof GROUP_TRANSFER_STATUSES)[number];

export const CONFIRMED_TRANSFER_STATUSES: GroupTransferStatus[] = [
  "confirmed",
  "auto_confirmed",
];

export interface IGroupTransfer extends Document {
  group: mongoose.Types.ObjectId;
  fromMember: mongoose.Types.ObjectId;
  toMember: mongoose.Types.ObjectId;
  fromAccount: mongoose.Types.ObjectId | null;
  toAccount: mongoose.Types.ObjectId | null;
  amount: number;
  currency: string;
  status: GroupTransferStatus;
  debitTransactionId: mongoose.Types.ObjectId | null;
  creditTransactionId: mongoose.Types.ObjectId | null;
  createdBy: mongoose.Types.ObjectId;
  resolvedBy: mongoose.Types.ObjectId | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const groupTransferSchema = new Schema<IGroupTransfer>(
  {
    group: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    fromMember: {
      type: Schema.Types.ObjectId,
      ref: "GroupMember",
      required: true,
    },
    toMember: {
      type: Schema.Types.ObjectId,
      ref: "GroupMember",
      required: true,
    },
    fromAccount: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    toAccount: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      default: "PKR",
      uppercase: true,
      match: /^[A-Z]{3}$/,
    },
    status: {
      type: String,
      required: true,
      enum: GROUP_TRANSFER_STATUSES,
      default: "pending",
      index: true,
    },
    debitTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },
    creditTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

groupTransferSchema.index({ group: 1, status: 1 });
groupTransferSchema.index({ toMember: 1, status: 1 });

export interface GroupTransferPublic {
  id: string;
  group: string;
  fromMemberId: string;
  toMemberId: string;
  fromDisplayName?: string;
  toDisplayName?: string;
  fromAccountId: string | null;
  toAccountId: string | null;
  fromAccountName?: string;
  toAccountName?: string;
  /** True when confirming would leave the sender account below zero. */
  senderWouldGoNegative?: boolean;
  amount: number;
  currency: string;
  status: GroupTransferStatus;
  createdBy: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toGroupTransferPublic(
  transfer: IGroupTransfer,
  extras?: {
    fromDisplayName?: string;
    toDisplayName?: string;
    fromAccountName?: string;
    toAccountName?: string;
    senderWouldGoNegative?: boolean;
  },
): GroupTransferPublic {
  return {
    id: transfer._id.toString(),
    group: transfer.group.toString(),
    fromMemberId: transfer.fromMember.toString(),
    toMemberId: transfer.toMember.toString(),
    ...(extras?.fromDisplayName !== undefined
      ? { fromDisplayName: extras.fromDisplayName }
      : {}),
    ...(extras?.toDisplayName !== undefined
      ? { toDisplayName: extras.toDisplayName }
      : {}),
    fromAccountId: transfer.fromAccount
      ? transfer.fromAccount.toString()
      : null,
    toAccountId: transfer.toAccount ? transfer.toAccount.toString() : null,
    ...(extras?.fromAccountName !== undefined
      ? { fromAccountName: extras.fromAccountName }
      : {}),
    ...(extras?.toAccountName !== undefined
      ? { toAccountName: extras.toAccountName }
      : {}),
    ...(extras?.senderWouldGoNegative !== undefined
      ? { senderWouldGoNegative: extras.senderWouldGoNegative }
      : {}),
    amount: transfer.amount,
    currency: transfer.currency,
    status: transfer.status,
    createdBy: transfer.createdBy.toString(),
    resolvedBy: transfer.resolvedBy ? transfer.resolvedBy.toString() : null,
    resolvedAt: transfer.resolvedAt
      ? transfer.resolvedAt.toISOString()
      : null,
    createdAt: transfer.createdAt.toISOString(),
    updatedAt: transfer.updatedAt.toISOString(),
  };
}

export const GroupTransfer: Model<IGroupTransfer> =
  (mongoose.models.GroupTransfer as Model<IGroupTransfer> | undefined) ??
  mongoose.model<IGroupTransfer>("GroupTransfer", groupTransferSchema);
