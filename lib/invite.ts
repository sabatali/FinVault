import { createHash, randomBytes } from "crypto";

import { getPublicAppUrl, sendMail } from "@/lib/email";
import { Group } from "@/models/Group";
import { GroupMember, type IGroupMember } from "@/models/GroupMember";
import { User } from "@/models/User";

export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const INVITE_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

export interface InviteSendResult {
  inviteSent: boolean;
  inviteUrl: string;
  warning?: string;
  member: IGroupMember;
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function buildInviteSignupUrl(input: {
  email: string;
  token: string;
  groupName?: string;
}): string {
  const url = new URL("/signup", getPublicAppUrl());
  url.searchParams.set("email", input.email);
  url.searchParams.set("invite", input.token);
  if (input.groupName) {
    url.searchParams.set("group", input.groupName);
  }
  return url.toString();
}

export function buildInviteLandingUrl(token: string): string {
  return `${getPublicAppUrl()}/invite/${token}`;
}

function inviteEmailContent(input: {
  groupName: string;
  inviterName: string;
  inviteUrl: string;
  guestName: string;
}) {
  const subject = `You're invited to ${input.groupName} on FinVault`;
  const text = [
    `Hi ${input.guestName},`,
    "",
    `${input.inviterName} added you to "${input.groupName}" on FinVault.`,
    "Create your account to join the group:",
    input.inviteUrl,
    "",
    "This invite expires in 14 days.",
  ].join("\n");

  const html = `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1d29;">
      <p>Hi ${escapeHtml(input.guestName)},</p>
      <p>
        <strong>${escapeHtml(input.inviterName)}</strong> added you to
        <strong>${escapeHtml(input.groupName)}</strong> on FinVault.
      </p>
      <p>
        <a href="${escapeAttr(input.inviteUrl)}"
           style="display:inline-block;background:#2f5fdc;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">
          Join FinVault
        </a>
      </p>
      <p style="color:#5a6072;font-size:14px;">This invite expires in 14 days.</p>
      <p style="color:#5a6072;font-size:12px;">Or open: ${escapeHtml(input.inviteUrl)}</p>
    </div>
  `;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

/**
 * Generates a new invite token, persists its hash, and attempts to email the guest.
 * Member creation must already have succeeded — email failure does not roll back.
 */
export async function issueAndSendGuestInvite(input: {
  member: IGroupMember;
  inviterUserId: string;
  regenerate?: boolean;
}): Promise<InviteSendResult> {
  const member = input.member;

  if (member.memberType !== "guest") {
    return {
      inviteSent: false,
      inviteUrl: "",
      warning: "Only guests receive invite emails.",
      member,
    };
  }

  const group = await Group.findById(member.group);
  const inviter = await User.findById(input.inviterUserId).select("name");
  const groupName = group?.name ?? "a FinVault group";
  const inviterName = inviter?.name ?? "A FinVault user";

  const rawToken = createInviteToken();
  const tokenHash = hashInviteToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

  member.inviteTokenHash = tokenHash;
  member.inviteSentAt = now;
  member.inviteExpiresAt = expiresAt;
  await member.save();

  const inviteUrl = buildInviteSignupUrl({
    email: member.email,
    token: rawToken,
    groupName,
  });
  const landingUrl = buildInviteLandingUrl(rawToken);

  if (process.env.NODE_ENV === "development") {
    console.info("[invite]", {
      memberId: member._id.toString(),
      email: member.email,
      inviteUrl,
      landingUrl,
    });
  }

  const content = inviteEmailContent({
    groupName,
    inviterName,
    inviteUrl: landingUrl,
    guestName: member.displayName,
  });

  const mail = await sendMail({
    to: member.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  if (!mail.sent) {
    return {
      inviteSent: false,
      inviteUrl,
      warning:
        mail.error === "SMTP is not configured"
          ? "Invite saved. Email was not sent because SMTP is not configured."
          : `Invite saved, but email failed: ${mail.error ?? "unknown error"}`,
      member,
    };
  }

  return {
    inviteSent: true,
    inviteUrl,
    member,
  };
}

export async function findGuestInviteByToken(rawToken: string): Promise<{
  member: IGroupMember;
  groupName: string;
  expired: boolean;
} | null> {
  if (!rawToken || rawToken.length < 16) {
    return null;
  }

  const tokenHash = hashInviteToken(rawToken);
  const member = await GroupMember.findOne({
    inviteTokenHash: tokenHash,
    memberType: "guest",
  });

  if (!member) {
    return null;
  }

  const group = await Group.findById(member.group).select("name");
  const expired =
    !member.inviteExpiresAt || member.inviteExpiresAt.getTime() < Date.now();

  return {
    member,
    groupName: group?.name ?? "FinVault group",
    expired,
  };
}

export function canResendInvite(member: IGroupMember): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  if (!member.inviteSentAt) {
    return { allowed: true };
  }

  const elapsed = Date.now() - member.inviteSentAt.getTime();
  if (elapsed >= INVITE_RESEND_COOLDOWN_MS) {
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((INVITE_RESEND_COOLDOWN_MS - elapsed) / 1000),
  };
}
