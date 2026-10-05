import mongoose, { type ClientSession } from "mongoose";

import { connectDB } from "@/lib/db";
import { Group, type IGroup } from "@/models/Group";
import {
  GroupMember,
  type GroupMemberRole,
  type IGroupMember,
} from "@/models/GroupMember";
import { GroupMemberAccount } from "@/models/GroupMemberAccount";
import { GroupExpense } from "@/models/GroupExpense";
import { GroupTransfer } from "@/models/GroupTransfer";

export class GroupAccessError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "GroupAccessError";
    this.status = status;
    this.code = code;
  }
}

function sessionOptions(session: ClientSession | null | undefined) {
  return session ? { session } : undefined;
}

export async function findGroupMembership(
  userId: string,
  groupId: string,
  session?: ClientSession | null,
): Promise<IGroupMember | null> {
  if (!mongoose.isValidObjectId(groupId)) {
    return null;
  }

  await connectDB();
  const query = GroupMember.findOne({
    group: groupId,
    user: userId,
    memberType: "registered",
  });
  if (session) {
    query.session(session);
  }
  return query;
}

export async function assertGroupMember(
  userId: string,
  groupId: string,
  session?: ClientSession | null,
): Promise<{ group: IGroup; membership: IGroupMember }> {
  if (!mongoose.isValidObjectId(groupId)) {
    throw new GroupAccessError("Group not found", 404);
  }

  await connectDB();

  const membership = await findGroupMembership(userId, groupId, session);
  if (!membership) {
    throw new GroupAccessError("Group not found", 404);
  }

  const groupQuery = Group.findById(groupId);
  if (session) {
    groupQuery.session(session);
  }
  const group = await groupQuery;

  if (!group) {
    throw new GroupAccessError("Group not found", 404);
  }

  return { group, membership };
}

export async function assertGroupAdmin(
  userId: string,
  groupId: string,
  session?: ClientSession | null,
): Promise<{ group: IGroup; membership: IGroupMember }> {
  const result = await assertGroupMember(userId, groupId, session);
  if (result.membership.role !== "admin") {
    throw new GroupAccessError("Forbidden", 403, "ADMIN_REQUIRED");
  }
  return result;
}

export function groupAccessErrorResponse(error: GroupAccessError) {
  return {
    error: error.message,
    ...(error.code ? { code: error.code } : {}),
  };
}

export async function countGroupAdmins(
  groupId: mongoose.Types.ObjectId | string,
): Promise<number> {
  await connectDB();
  return GroupMember.countDocuments({
    group: groupId,
    role: "admin",
  });
}

export async function memberActivityCounts(
  memberId: mongoose.Types.ObjectId | string,
): Promise<{ expenses: number; transfers: number }> {
  await connectDB();
  const [expenses, transfers] = await Promise.all([
    GroupExpense.countDocuments({
      $or: [
        { payerMember: memberId },
        { "participants.member": memberId },
      ],
    }),
    GroupTransfer.countDocuments({
      $or: [{ fromMember: memberId }, { toMember: memberId }],
    }),
  ]);
  return { expenses, transfers };
}

/**
 * Block remove when the member appears on expenses or transfers.
 */
export async function memberHasActivity(
  memberId: mongoose.Types.ObjectId | string,
): Promise<boolean> {
  const counts = await memberActivityCounts(memberId);
  return counts.expenses > 0 || counts.transfers > 0;
}

export async function listGroupsForUser(userId: string): Promise<
  Array<{
    group: IGroup;
    role: GroupMemberRole;
  }>
> {
  await connectDB();

  const memberships = await GroupMember.find({
    user: userId,
    memberType: "registered",
  }).sort({ createdAt: -1 });

  if (memberships.length === 0) {
    return [];
  }

  const groupIds = memberships.map((membership) => membership.group);
  const groups = await Group.find({ _id: { $in: groupIds } });
  const groupMap = new Map(groups.map((group) => [group._id.toString(), group]));

  const rows: Array<{ group: IGroup; role: GroupMemberRole }> = [];
  for (const membership of memberships) {
    const group = groupMap.get(membership.group.toString());
    if (group) {
      rows.push({ group, role: membership.role });
    }
  }

  rows.sort((a, b) => b.group.updatedAt.getTime() - a.group.updatedAt.getTime());
  return rows;
}

export async function listMembersForGroup(
  groupId: string,
): Promise<IGroupMember[]> {
  if (!mongoose.isValidObjectId(groupId)) {
    return [];
  }

  await connectDB();

  const members = await GroupMember.find({ group: groupId });

  return members.sort((a, b) => {
    if (a.role !== b.role) {
      return a.role === "admin" ? -1 : 1;
    }
    if (a.memberType !== b.memberType) {
      return a.memberType === "registered" ? -1 : 1;
    }
    return a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: "base",
    });
  });
}

/**
 * Block group delete when expenses/transfers exist.
 */
export async function groupHasFinancialHistory(
  groupId: mongoose.Types.ObjectId | string,
): Promise<boolean> {
  await connectDB();
  const count = await GroupExpense.countDocuments({ group: groupId });
  return count > 0;
}

export async function deleteGroupAndMembers(
  groupId: mongoose.Types.ObjectId | string,
  session: ClientSession | null,
): Promise<void> {
  await GroupMemberAccount.deleteMany(
    { group: groupId },
    sessionOptions(session),
  );
  await GroupMember.deleteMany({ group: groupId }, sessionOptions(session));
  await Group.deleteOne({ _id: groupId }, sessionOptions(session));
}
