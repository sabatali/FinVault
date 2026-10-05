"use client";

import { useMemo, useState } from "react";

import { AddMemberForm } from "@/components/groups/AddMemberForm";
import { MemberBadge, memberInitials } from "@/components/groups/MemberBadge";
import { RemoveMemberDialog } from "@/components/groups/RemoveMemberDialog";
import type { GroupMemberPublic, GroupMemberRole } from "@/models/GroupMember";

interface MemberListProps {
  groupId: string;
  groupName: string;
  initialMembers: GroupMemberPublic[];
  isAdmin: boolean;
}

function sortMembers(members: GroupMemberPublic[]): GroupMemberPublic[] {
  return [...members].sort((a, b) => {
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

function inviteStatusLabel(status: GroupMemberPublic["inviteStatus"]): string | null {
  switch (status) {
    case "sent":
      return "Invite sent";
    case "pending":
      return "Invite pending";
    case "expired":
      return "Invite expired";
    default:
      return null;
  }
}

export function MemberList({
  groupId,
  groupName,
  initialMembers,
  isAdmin,
}: MemberListProps) {
  const [members, setMembers] = useState(() => sortMembers(initialMembers));
  const [rowError, setRowError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<{
    tone: "success" | "warning";
    message: string;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<GroupMemberPublic | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeActivity, setRemoveActivity] = useState<{
    expenses: number;
    transfers: number;
  } | null>(null);

  const adminCount = useMemo(
    () => members.filter((member) => member.role === "admin").length,
    [members],
  );

  async function handleRoleChange(member: GroupMemberPublic, role: GroupMemberRole) {
    if (role === member.role) {
      return;
    }

    setBusyId(member.id);
    setRowError(null);

    try {
      const response = await fetch(`/api/groups/${groupId}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      const data = (await response.json()) as {
        member?: GroupMemberPublic;
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        setRowError(data.error ?? "Unable to update role.");
        return;
      }

      if (data.member) {
        setMembers((current) =>
          sortMembers(
            current.map((item) => (item.id === data.member!.id ? data.member! : item)),
          ),
        );
      }
    } catch {
      setRowError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleResendInvite(member: GroupMemberPublic) {
    setBusyId(member.id);
    setRowError(null);
    setInviteNotice(null);

    try {
      const response = await fetch(
        `/api/groups/${groupId}/members/${member.id}/resend-invite`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = (await response.json()) as {
        member?: GroupMemberPublic;
        error?: string;
        inviteSent?: boolean;
        inviteWarning?: string;
        devInviteUrl?: string;
      };

      if (!response.ok) {
        setRowError(data.error ?? "Unable to resend invite.");
        return;
      }

      if (data.member) {
        setMembers((current) =>
          sortMembers(
            current.map((item) => (item.id === data.member!.id ? data.member! : item)),
          ),
        );
      }

      if (data.devInviteUrl) {
        console.info("[devInviteUrl]", data.devInviteUrl);
      }

      if (data.inviteSent) {
        setInviteNotice({
          tone: "success",
          message: `Invite resent to ${member.email}.`,
        });
      } else {
        setInviteNotice({
          tone: "warning",
          message:
            data.inviteWarning ??
            `Invite updated for ${member.email}, but email was not sent.`,
        });
      }
    } catch {
      setRowError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemoveConfirm() {
    if (!removeTarget) {
      return;
    }

    setRemoveLoading(true);
    setRemoveError(null);

    try {
      const response = await fetch(
        `/api/groups/${groupId}/members/${removeTarget.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = (await response.json()) as {
        error?: string;
        details?: { expenses: number; transfers: number };
      };

      if (!response.ok) {
        setRemoveError(data.error ?? "Unable to remove member.");
        setRemoveActivity(data.details ?? null);
        return;
      }

      const removedId = removeTarget.id;
      setRemoveTarget(null);
      setMembers((current) => current.filter((item) => item.id !== removedId));
    } catch {
      setRemoveError("Network error. Please try again.");
    } finally {
      setRemoveLoading(false);
    }
  }

  if (members.length === 0) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800"
      >
        No members found. Every group should have at least its creator.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {inviteNotice ? (
        <div
          role="status"
          className={
            inviteNotice.tone === "success"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          }
        >
          {inviteNotice.message}
        </div>
      ) : null}

      {rowError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {rowError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#e4e7ee] bg-white">
        {isAdmin ? (
          <div className="border-b border-[#e4e7ee] p-4">
            <AddMemberForm
              embedded
              groupId={groupId}
              onAdded={(member, meta) => {
                setMembers((current) => sortMembers([...current, member]));
                setRowError(null);

                if (member.memberType !== "guest") {
                  setInviteNotice(null);
                  return;
                }

                if (meta?.inviteSent) {
                  setInviteNotice({
                    tone: "success",
                    message: `Invite sent to ${member.email}.`,
                  });
                } else {
                  setInviteNotice({
                    tone: "warning",
                    message:
                      meta?.inviteWarning ??
                      `Guest added. Invite email was not sent — use Resend invite.`,
                  });
                }
              }}
            />
          </div>
        ) : null}

        <ul className="divide-y divide-[#e4e7ee]">
          {members.map((member) => {
            const isLastAdmin = member.role === "admin" && adminCount <= 1;
            const inviteLabel = inviteStatusLabel(member.inviteStatus);
            const showResend =
              isAdmin &&
              member.memberType === "guest" &&
              !member.claimedAt;

            return (
              <li
                key={member.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div
                    aria-hidden="true"
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      member.memberType === "guest"
                        ? "bg-amber-50 text-amber-900"
                        : "bg-[#eef1f8] text-[#2f5fdc]"
                    }`}
                  >
                    {memberInitials(member.displayName)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-[#1a1d29]">
                        {member.displayName}
                      </p>
                      <MemberBadge memberType={member.memberType} role={member.role} />
                      {inviteLabel ? (
                        <span className="rounded-full bg-[#eef1f8] px-2 py-0.5 text-xs font-medium text-[#5a6072]">
                          {inviteLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-[#5a6072]">{member.email}</p>
                  </div>
                </div>

                {isAdmin ? (
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {showResend ? (
                      <button
                        type="button"
                        disabled={busyId === member.id}
                        aria-label={`Resend invite to ${member.displayName}`}
                        onClick={() => void handleResendInvite(member)}
                        className="rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm font-medium text-[#2f5fdc] hover:bg-[#eef1f8] disabled:opacity-60"
                      >
                        {busyId === member.id ? "Sending…" : "Resend invite"}
                      </button>
                    ) : null}
                    <label className="sr-only" htmlFor={`role-${member.id}`}>
                      Role for {member.displayName}
                    </label>
                    <select
                      id={`role-${member.id}`}
                      aria-label={`Role for ${member.displayName}`}
                      value={member.role}
                      disabled={busyId === member.id || isLastAdmin}
                      onChange={(event) =>
                        void handleRoleChange(
                          member,
                          event.target.value as GroupMemberRole,
                        )
                      }
                      className="rounded-lg border border-[#e4e7ee] bg-white px-3 py-2 text-sm text-[#1a1d29] disabled:opacity-60"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="button"
                      disabled={isLastAdmin}
                      title={
                        isLastAdmin
                          ? "Cannot remove the last admin"
                          : `Remove ${member.displayName}`
                      }
                      onClick={() => {
                        setRemoveError(null);
                        setRemoveTarget(member);
                      }}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <RemoveMemberDialog
        memberName={removeTarget?.displayName ?? ""}
        groupName={groupName}
        open={Boolean(removeTarget)}
        loading={removeLoading}
        error={removeError}
        activityDetails={removeActivity}
        onConfirm={() => void handleRemoveConfirm()}
        onCancel={() => {
          if (!removeLoading) {
            setRemoveTarget(null);
            setRemoveError(null);
            setRemoveActivity(null);
          }
        }}
      />
    </div>
  );
}

export function MemberListSkeleton() {
  return (
    <div className="space-y-0 overflow-hidden rounded-xl border border-[#e4e7ee] bg-white animate-pulse">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-[#e4e7ee] px-4 py-4 last:border-0"
        >
          <div className="h-10 w-10 rounded-full bg-[#e4e7ee]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-[#e4e7ee]" />
            <div className="h-3 w-56 rounded bg-[#e4e7ee]" />
          </div>
        </div>
      ))}
    </div>
  );
}
