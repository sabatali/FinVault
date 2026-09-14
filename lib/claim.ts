import type { ClientSession } from "mongoose";
import mongoose from "mongoose";

import { hashInviteToken } from "@/lib/invite";
import { Group } from "@/models/Group";
import {
  GroupMember,
  type GroupMemberRole,
  type IGroupMember,
} from "@/models/GroupMember";
import type { IUser } from "@/models/User";

export interface ClaimedGroupInfo {
  groupId: string;
  groupName: string;
  memberId: string;
}

export interface ClaimGuestResult {
  claimed: ClaimedGroupInfo[];
  inviteWarning?: string;
}

export interface PendingGuestClaim {
  memberId: string;
  groupId: string;
  groupName: string;
  displayName: string;
  role: GroupMemberRole;
  email: string;
  dismissed: boolean;
}

function sessionOptions(session: ClientSession | null | undefined) {
  return session ? { session } : undefined;
}

async function claimOneGuestMember(input: {
  member: IGroupMember;
  user: IUser;
  session: ClientSession | null;
}): Promise<ClaimedGroupInfo | null> {
  const { member, user, session } = input;
  const opts = sessionOptions(session);

  if (member.memberType !== "guest") {
    return null;
  }

  const existingRegisteredQuery = GroupMember.findOne({
    group: member.group,
    user: user._id,
    memberType: "registered",
  });
  if (session) {
    existingRegisteredQuery.session(session);
  }
  const existingRegistered = await existingRegisteredQuery;

  if (existingRegistered) {
    console.error(
      "[claim] Skipping guest; registered membership already exists for user in group",
      {
        guestMemberId: member._id.toString(),
        existingMemberId: existingRegistered._id.toString(),
        groupId: member.group.toString(),
        userId: user._id.toString(),
      },
    );
    return null;
  }

  const memberId = member._id.toString();
  const groupId = member.group.toString();

  member.user = user._id;
  member.memberType = "registered";
  member.displayName = user.name.trim() || member.displayName;
  member.claimedAt = new Date();
  member.inviteTokenHash = null;
  member.inviteSentAt = null;
  member.inviteExpiresAt = null;
  await member.save(opts);

  const dismissed = user.dismissedGuestMemberIds ?? [];
  const nextDismissed = dismissed.filter((id) => id.toString() !== memberId);
  if (nextDismissed.length !== dismissed.length) {
    user.dismissedGuestMemberIds = nextDismissed;
    await user.save(opts);
  }

  const groupQuery = Group.findById(member.group).select("name");
  if (session) {
    groupQuery.session(session);
  }
  const group = await groupQuery;

  return {
    groupId,
    groupName: group?.name ?? "FinVault group",
    memberId,
  };
}

/**
 * Converts guest GroupMembers whose email matches the user into registered
 * members. Preserves GroupMember._id so expense/transfer history stays intact.
 *
 * - Default / signup: claim all matching guests (optional invite token first).
 * - Explicit claim: pass `memberIds` to claim only those (still email-checked).
 */
export async function claimGuestMembershipsForUser(
  user: IUser,
  session: ClientSession | null,
  options?: { inviteToken?: string; memberIds?: string[] },
): Promise<ClaimGuestResult> {
  const email = user.email.toLowerCase().trim();
  const claimed: ClaimedGroupInfo[] = [];
  const claimedIds = new Set<string>();
  let inviteWarning: string | undefined;
  let excludeMemberId: string | undefined;

  if (options?.memberIds && options.memberIds.length > 0) {
    const uniqueIds = [...new Set(options.memberIds)].filter((id) =>
      mongoose.isValidObjectId(id),
    );

    for (const memberId of uniqueIds) {
      const memberQuery = GroupMember.findById(memberId);
      if (session) {
        memberQuery.session(session);
      }
      const member = await memberQuery;

      if (!member || member.memberType !== "guest") {
        continue;
      }
      if (member.email.toLowerCase().trim() !== email) {
        continue;
      }

      const result = await claimOneGuestMember({
        member,
        user,
        session,
      });
      if (result) {
        claimed.push(result);
        claimedIds.add(result.memberId);
      }
    }

    return { claimed };
  }

  const inviteToken = options?.inviteToken?.trim();
  if (inviteToken) {
    const tokenHash = hashInviteToken(inviteToken);
    const inviteQuery = GroupMember.findOne({
      inviteTokenHash: tokenHash,
      memberType: "guest",
    });
    if (session) {
      inviteQuery.session(session);
    }
    const inviteMember = await inviteQuery;

    if (!inviteMember) {
      inviteWarning =
        "Invite token was invalid. Your account was created; matching guest profiles were still linked by email when found.";
    } else if (inviteMember.email.toLowerCase().trim() !== email) {
      excludeMemberId = inviteMember._id.toString();
      inviteWarning =
        "Invite email did not match the account email. Your account was created without claiming that invite.";
    } else if (
      !inviteMember.inviteExpiresAt ||
      inviteMember.inviteExpiresAt.getTime() < Date.now()
    ) {
      inviteWarning =
        "That invite has expired. Your account was created; we still linked matching guest profiles by email.";
    } else {
      const claimedInvite = await claimOneGuestMember({
        member: inviteMember,
        user,
        session,
      });
      if (claimedInvite) {
        claimed.push(claimedInvite);
        claimedIds.add(claimedInvite.memberId);
      }
    }
  }

  const guestsQuery = GroupMember.find({
    memberType: "guest",
    email,
  });
  if (session) {
    guestsQuery.session(session);
  }
  const guests = await guestsQuery;

  for (const guest of guests) {
    const id = guest._id.toString();
    if (claimedIds.has(id)) {
      continue;
    }
    if (excludeMemberId && id === excludeMemberId) {
      continue;
    }

    const result = await claimOneGuestMember({
      member: guest,
      user,
      session,
    });
    if (result) {
      claimed.push(result);
      claimedIds.add(result.memberId);
    }
  }

  return { claimed, inviteWarning };
}

export async function listPendingGuestClaimsForUser(
  user: IUser,
): Promise<PendingGuestClaim[]> {
  const email = user.email.toLowerCase().trim();
  const dismissed = new Set(
    (user.dismissedGuestMemberIds ?? []).map((id) => id.toString()),
  );

  const guests = await GroupMember.find({
    memberType: "guest",
    email,
    $or: [{ user: null }, { user: { $exists: false } }],
  }).sort({ createdAt: 1 });

  if (guests.length === 0) {
    return [];
  }

  const groups = await Group.find({
    _id: { $in: guests.map((guest) => guest.group) },
  }).select("name");
  const groupNameById = new Map(
    groups.map((group) => [group._id.toString(), group.name]),
  );

  return guests.map((guest) => {
    const memberId = guest._id.toString();
    return {
      memberId,
      groupId: guest.group.toString(),
      groupName: groupNameById.get(guest.group.toString()) ?? "FinVault group",
      displayName: guest.displayName,
      role: guest.role,
      email: guest.email,
      dismissed: dismissed.has(memberId),
    };
  });
}

export async function dismissGuestClaimsForUser(
  user: IUser,
  memberIds: string[],
): Promise<{ dismissedMemberIds: string[] }> {
  const email = user.email.toLowerCase().trim();
  const uniqueIds = [...new Set(memberIds)].filter((id) =>
    mongoose.isValidObjectId(id),
  );

  if (uniqueIds.length === 0) {
    return { dismissedMemberIds: [] };
  }

  const guests = await GroupMember.find({
    _id: { $in: uniqueIds },
    memberType: "guest",
    email,
  }).select("_id");

  const validIds = guests.map((guest) => guest._id);
  const validIdSet = new Set(validIds.map((id) => id.toString()));
  const existing = new Set(
    (user.dismissedGuestMemberIds ?? []).map((id) => id.toString()),
  );

  for (const id of validIds) {
    existing.add(id.toString());
  }

  user.dismissedGuestMemberIds = [...existing].map(
    (id) => new mongoose.Types.ObjectId(id),
  );
  await user.save();

  return { dismissedMemberIds: [...validIdSet] };
}
