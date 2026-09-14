import { getPublicAppUrl, sendMail } from "@/lib/email";
import { connectDB } from "@/lib/db";
import { formatPkrAmount } from "@/lib/fx";
import type { IGroup } from "@/models/Group";
import type { IGroupExpense } from "@/models/GroupExpense";
import { GroupMember, type IGroupMember } from "@/models/GroupMember";
import type { IGroupTransfer } from "@/models/GroupTransfer";
import {
  Notification,
  type NotificationType,
  toNotificationPublic,
} from "@/models/Notification";
import { User } from "@/models/User";

function sanitizeHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/groups";
  }
  if (trimmed.includes("://")) {
    return "/groups";
  }
  return trimmed.slice(0, 200);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function notificationEmail(input: {
  title: string;
  body: string;
  href: string;
}) {
  const url = `${getPublicAppUrl()}${input.href}`;
  const subject = input.title;
  const text = `${input.body}\n\nOpen: ${url}`;
  const html = `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1d29;">
      <p><strong>${escapeHtml(input.title)}</strong></p>
      <p>${escapeHtml(input.body)}</p>
      <p>
        <a href="${escapeHtml(url)}"
           style="display:inline-block;background:#2f5fdc;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">
          Open in FinVault
        </a>
      </p>
    </div>
  `;
  return { subject, text, html };
}

function queueEmail(to: string, title: string, body: string, href: string) {
  if (!to.trim()) {
    return;
  }
  const content = notificationEmail({ title, body, href });
  void sendMail({
    to: to.trim(),
    subject: content.subject,
    html: content.html,
    text: content.text,
  }).then((result) => {
    if (!result.sent) {
      console.error("[notify:email]", result.error ?? "Email not sent", {
        to,
        title,
      });
    }
  });
}

export async function notifyInApp(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  email?: string | null;
}) {
  await connectDB();

  const href = sanitizeHref(input.href);
  const title = input.title.trim().slice(0, 120);
  const body = input.body.trim().slice(0, 400);

  const [doc] = await Notification.create([
    {
      user: input.userId,
      type: input.type,
      title,
      body,
      href,
      readAt: null,
    },
  ]);

  const email =
    input.email ??
    (await User.findById(input.userId).select("email"))?.email ??
    null;
  if (email) {
    queueEmail(email, title, body, href);
  }

  return toNotificationPublic(doc!);
}

export async function notifyEmailOnly(input: {
  email: string;
  title: string;
  body: string;
  href: string;
}) {
  queueEmail(
    input.email,
    input.title.trim().slice(0, 120),
    input.body.trim().slice(0, 400),
    sanitizeHref(input.href),
  );
}

export async function notifyGroupExpenseAdded(input: {
  group: IGroup;
  expense: IGroupExpense;
  actorUserId: string;
}) {
  await connectDB();

  const members = await GroupMember.find({ group: input.group._id });
  const href = `/groups/${input.group._id.toString()}/expenses/${input.expense._id.toString()}`;
  const amount = formatPkrAmount(input.expense.amount, {
    displayCurrency: "PKR",
  });
  const title = `New expense in ${input.group.name}`;
  const body = `${input.expense.description} · ${amount}`;

  const participantIds = new Set(
    input.expense.participants.map((row) => row.member.toString()),
  );

  for (const member of members) {
    if (member.memberType === "registered" && member.user) {
      if (member.user.toString() === input.actorUserId) {
        continue;
      }
      await notifyInApp({
        userId: member.user.toString(),
        type: "group_expense_added",
        title,
        body,
        href,
      });
      continue;
    }

    if (
      member.memberType === "guest" &&
      member.email &&
      participantIds.has(member._id.toString())
    ) {
      notifyEmailOnly({
        email: member.email,
        title,
        body: `${body} (you were included in this split)`,
        href,
      });
    }
  }
}

export async function notifySettlementRequested(input: {
  group: IGroup;
  transfer: IGroupTransfer;
  toMember: IGroupMember;
  actorUserId: string;
}) {
  if (
    input.toMember.memberType !== "registered" ||
    !input.toMember.user ||
    input.toMember.user.toString() === input.actorUserId
  ) {
    return;
  }

  const amount = formatPkrAmount(input.transfer.amount, {
    displayCurrency: "PKR",
  });
  await notifyInApp({
    userId: input.toMember.user.toString(),
    type: "settlement_requested",
    title: `Settlement requested in ${input.group.name}`,
    body: `Someone sent you ${amount}. Confirm to update balances.`,
    href: `/groups/${input.group._id.toString()}#settlements-heading`,
  });
}

export async function notifySettlementConfirmed(input: {
  group: IGroup;
  transfer: IGroupTransfer;
  fromMember: IGroupMember;
  actorUserId: string;
}) {
  if (
    input.fromMember.memberType !== "registered" ||
    !input.fromMember.user ||
    input.fromMember.user.toString() === input.actorUserId
  ) {
    return;
  }

  const amount = formatPkrAmount(input.transfer.amount, {
    displayCurrency: "PKR",
  });
  await notifyInApp({
    userId: input.fromMember.user.toString(),
    type: "settlement_confirmed",
    title: `Settlement confirmed in ${input.group.name}`,
    body: `Your ${amount} settlement was confirmed.`,
    href: `/groups/${input.group._id.toString()}`,
  });
}

export async function notifySettlementAutoConfirmed(input: {
  group: IGroup;
  transfer: IGroupTransfer;
  fromMember: IGroupMember;
  toMember: IGroupMember;
  actorUserId: string;
}) {
  const amount = formatPkrAmount(input.transfer.amount, {
    displayCurrency: "PKR",
  });
  const title = `Settlement recorded in ${input.group.name}`;
  const body = `${amount} settled (guest involved — auto-confirmed).`;
  const href = `/groups/${input.group._id.toString()}`;

  const parties: IGroupMember[] = [input.fromMember, input.toMember];
  for (const member of parties) {
    if (member.memberType === "registered" && member.user) {
      if (member.user.toString() === input.actorUserId) {
        continue;
      }
      await notifyInApp({
        userId: member.user.toString(),
        type: "settlement_auto_confirmed",
        title,
        body,
        href,
      });
    } else if (member.memberType === "guest" && member.email) {
      notifyEmailOnly({
        email: member.email,
        title,
        body,
        href,
      });
    }
  }
}
