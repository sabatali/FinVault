import mongoose, { Schema, type Document, type Model } from "mongoose";

export const GROUP_MEMBER_TYPES = ["registered", "guest"] as const;
export type GroupMemberType = (typeof GROUP_MEMBER_TYPES)[number];

export const GROUP_MEMBER_ROLES = ["admin", "member"] as const;
export type GroupMemberRole = (typeof GROUP_MEMBER_ROLES)[number];

export interface IGroupMember extends Document {
  group: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId | null;
  memberType: GroupMemberType;
  displayName: string;
  email: string;
  role: GroupMemberRole;
  inviteTokenHash: string | null;
  inviteSentAt: Date | null;
  inviteExpiresAt: Date | null;
  claimedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const groupMemberSchema = new Schema<IGroupMember>(
  {
    group: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    memberType: {
      type: String,
      required: true,
      enum: GROUP_MEMBER_TYPES,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      enum: GROUP_MEMBER_ROLES,
      default: "member",
    },
    inviteTokenHash: {
      type: String,
      default: null,
    },
    inviteSentAt: {
      type: Date,
      default: null,
    },
    inviteExpiresAt: {
      type: Date,
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

groupMemberSchema.index({ group: 1 });
groupMemberSchema.index({ user: 1 });
groupMemberSchema.index(
  { group: 1, user: 1 },
  {
    unique: true,
    partialFilterExpression: { user: { $type: "objectId" } },
  },
);
groupMemberSchema.index({ group: 1, email: 1 }, { unique: true });

export interface GroupMemberPublic {
  id: string;
  group: string;
  memberType: GroupMemberType;
  displayName: string;
  email: string;
  role: GroupMemberRole;
  userId: string | null;
  inviteSentAt: string | null;
  inviteExpiresAt: string | null;
  inviteStatus: "none" | "pending" | "sent" | "expired";
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function resolveInviteStatus(member: IGroupMember): GroupMemberPublic["inviteStatus"] {
  if (member.memberType !== "guest") {
    return "none";
  }
  if (!member.inviteTokenHash) {
    return "pending";
  }
  if (member.inviteExpiresAt && member.inviteExpiresAt.getTime() < Date.now()) {
    return "expired";
  }
  return member.inviteSentAt ? "sent" : "pending";
}

export function toGroupMemberPublic(member: IGroupMember): GroupMemberPublic {
  return {
    id: member._id.toString(),
    group: member.group.toString(),
    memberType: member.memberType,
    displayName: member.displayName,
    email: member.email,
    role: member.role,
    userId: member.user ? member.user.toString() : null,
    inviteSentAt: member.inviteSentAt ? member.inviteSentAt.toISOString() : null,
    inviteExpiresAt: member.inviteExpiresAt
      ? member.inviteExpiresAt.toISOString()
      : null,
    inviteStatus: resolveInviteStatus(member),
    claimedAt: member.claimedAt ? member.claimedAt.toISOString() : null,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}

export const GroupMember: Model<IGroupMember> =
  (mongoose.models.GroupMember as Model<IGroupMember> | undefined) ??
  mongoose.model<IGroupMember>("GroupMember", groupMemberSchema);
