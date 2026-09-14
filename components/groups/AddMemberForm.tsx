"use client";

import { FormEvent, useState } from "react";

import type { GroupMemberPublic, GroupMemberRole } from "@/models/GroupMember";

interface AddMemberFormProps {
  groupId: string;
  onAdded: (member: GroupMemberPublic, meta?: { inviteWarning?: string; inviteSent?: boolean }) => void;
  /** When true, omit the outer card chrome (parent provides the border). */
  embedded?: boolean;
}

export function AddMemberForm({
  groupId,
  onAdded,
  embedded = false,
}: AddMemberFormProps) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<GroupMemberRole>("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showName, setShowName] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      const response = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          displayName: displayName.trim() || undefined,
          role,
        }),
      });

      const data = (await response.json()) as {
        member?: GroupMemberPublic;
        error?: string;
        fields?: Record<string, string>;
        inviteSent?: boolean;
        inviteWarning?: string;
        devInviteUrl?: string;
      };

      if (!response.ok) {
        if (data.fields?.displayName) {
          setShowName(true);
        }
        if (data.fields) {
          setFieldErrors(data.fields);
        }
        setError(data.error ?? "Unable to add member.");
        return;
      }

      if (data.member) {
        if (data.devInviteUrl) {
          console.info("[devInviteUrl]", data.devInviteUrl);
        }
        onAdded(data.member, {
          inviteSent: data.inviteSent,
          inviteWarning: data.inviteWarning,
        });
      }
      setEmail("");
      setDisplayName("");
      setRole("member");
      setShowName(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        embedded
          ? "space-y-3"
          : "rounded-xl border border-[#e4e7ee] bg-white p-4 space-y-3"
      }
      noValidate
    >
      <h3 className="text-sm font-semibold text-[#1a1d29]">Add member</h3>
      <p className="text-xs text-[#5a6072]">
        Existing FinVault emails join as registered members. Unknown emails need a
        display name and join as guests (invite email attempted).
      </p>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor="add-member-email" className="block text-xs font-semibold text-[#5a6072]">
            Email
          </label>
          <input
            id="add-member-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
            required
          />
          {fieldErrors.email ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="add-member-role" className="block text-xs font-semibold text-[#5a6072]">
            Role
          </label>
          <select
            id="add-member-role"
            value={role}
            onChange={(event) => setRole(event.target.value as GroupMemberRole)}
            className="mt-1 w-full rounded-lg border border-[#e4e7ee] bg-white px-3 py-2 text-sm text-[#1a1d29]"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {showName || displayName || fieldErrors.displayName ? (
        <div>
          <label
            htmlFor="add-member-name"
            className="block text-xs font-semibold text-[#5a6072]"
          >
            Display name <span className="font-normal">(required for guests)</span>
          </label>
          <input
            id="add-member-name"
            type="text"
            maxLength={80}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
            placeholder="Ali"
          />
          {fieldErrors.displayName ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.displayName}</p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowName(true)}
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          Adding a guest? Enter a display name
        </button>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae] disabled:opacity-70"
      >
        {loading ? "Adding…" : "Add member"}
      </button>
    </form>
  );
}
