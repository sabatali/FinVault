import mongoose, { Schema, type Document, type Model } from "mongoose";

import { type AccountPublic, toAccountPublic, type IAccount } from "@/models/Account";

export interface IGroupMemberAccount extends Document {
  group: mongoose.Types.ObjectId;
  groupMember: mongoose.Types.ObjectId;
  account: mongoose.Types.ObjectId;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const groupMemberAccountSchema = new Schema<IGroupMemberAccount>(
  {
    group: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    groupMember: {
      type: Schema.Types.ObjectId,
      ref: "GroupMember",
      required: true,
      index: true,
    },
    account: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

groupMemberAccountSchema.index({ group: 1, account: 1 }, { unique: true });
groupMemberAccountSchema.index(
  { groupMember: 1, account: 1 },
  { unique: true },
);
/** At most one primary linked account per group member. */
groupMemberAccountSchema.index(
  { groupMember: 1 },
  {
    unique: true,
    partialFilterExpression: { isPrimary: true },
  },
);

export interface GroupMemberAccountPublic {
  id: string;
  group: string;
  groupMember: string;
  accountId: string;
  isPrimary: boolean;
  account: AccountPublic;
  createdAt: string;
  updatedAt: string;
}

export function toGroupMemberAccountPublic(
  link: IGroupMemberAccount,
  account: IAccount,
): GroupMemberAccountPublic {
  return {
    id: link._id.toString(),
    group: link.group.toString(),
    groupMember: link.groupMember.toString(),
    accountId: account._id.toString(),
    isPrimary: link.isPrimary,
    account: toAccountPublic(account),
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  };
}

export const GroupMemberAccount: Model<IGroupMemberAccount> =
  (mongoose.models.GroupMemberAccount as Model<IGroupMemberAccount> | undefined) ??
  mongoose.model<IGroupMemberAccount>(
    "GroupMemberAccount",
    groupMemberAccountSchema,
  );
