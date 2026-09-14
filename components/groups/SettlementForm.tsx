"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ACCOUNT_TYPE_LABELS } from "@/lib/format";
import type { GroupMemberPublic } from "@/models/GroupMember";
import type { GroupMemberAccountPublic } from "@/models/GroupMemberAccount";
import type { GroupTransferPublic } from "@/models/GroupTransfer";

export interface SettlementPrefill {
  fromMemberId: string;
  toMemberId: string;
  amount: string;
}

interface SettlementFormProps {
  groupId: string;
  members: GroupMemberPublic[];
  currentMemberId: string;
  prefill?: SettlementPrefill | null;
  onCreated?: (transfer: GroupTransferPublic) => void;
}

export function SettlementForm({
  groupId,
  members,
  currentMemberId,
  prefill = null,
  onCreated,
}: SettlementFormProps) {
  const { format } = useMoney();
  const router = useRouter();
  const otherMembers = useMemo(
    () => members.filter((member) => member.id !== currentMemberId),
    [members, currentMemberId],
  );

  const [fromMemberId, setFromMemberId] = useState(
    () => prefill?.fromMemberId ?? currentMemberId,
  );
  const [toMemberId, setToMemberId] = useState(() => {
    if (prefill?.toMemberId) {
      return prefill.toMemberId;
    }
    const others = members.filter((member) => member.id !== currentMemberId);
    return others[0]?.id ?? "";
  });
  const [amount, setAmount] = useState(() => prefill?.amount ?? "");
  const [fromAccountId, setFromAccountId] = useState("");
  const [links, setLinks] = useState<GroupMemberAccountPublic[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  const fromMember = members.find((member) => member.id === fromMemberId);
  const effectiveToMemberId =
    toMemberId === fromMemberId
      ? (members.find((member) => member.id !== fromMemberId)?.id ?? "")
      : toMemberId;
  const toMember = members.find((member) => member.id === effectiveToMemberId);
  const senderIsSelf = fromMemberId === currentMemberId;
  const senderIsGuest = fromMember?.memberType === "guest";
  const involvesGuest =
    fromMember?.memberType === "guest" || toMember?.memberType === "guest";

  const toOptions = useMemo(
    () => members.filter((member) => member.id !== fromMemberId),
    [members, fromMemberId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLinks() {
      if (!senderIsSelf) {
        setLinks([]);
        setFromAccountId("");
        setLinksLoading(false);
        return;
      }

      setLinksLoading(true);
      try {
        const response = await fetch(`/api/groups/${groupId}/linked-accounts`, {
          credentials: "include",
        });
        const data = (await response.json()) as {
          linkedAccounts?: GroupMemberAccountPublic[];
          primaryAccountId?: string | null;
          error?: string;
        };
        if (!cancelled) {
          if (response.ok) {
            const list = data.linkedAccounts ?? [];
            setLinks(list);
            setFromAccountId(
              list.find((link) => link.isPrimary)?.accountId ??
                data.primaryAccountId ??
                list[0]?.accountId ??
                "",
            );
          } else {
            setError(data.error ?? "Unable to load linked accounts.");
          }
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load linked accounts.");
        }
      } finally {
        if (!cancelled) {
          setLinksLoading(false);
        }
      }
    }

    void loadLinks();
    return () => {
      cancelled = true;
    };
  }, [groupId, senderIsSelf]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSuccess(null);
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        toMemberId: effectiveToMemberId,
        amount: Number(amount),
        fromMemberId,
      };
      if (!senderIsGuest && fromAccountId) {
        body.fromAccountId = fromAccountId;
      }

      const response = await fetch(`/api/groups/${groupId}/transfers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as {
        transfer?: GroupTransferPublic;
        autoConfirmed?: boolean;
        error?: string;
        fields?: Record<string, string>;
      };

      if (!response.ok) {
        if (data.fields) {
          setFieldErrors(data.fields);
        }
        setError(data.error ?? "Unable to create settlement.");
        return;
      }

      if (data.transfer) {
        onCreated?.(data.transfer);
        if (data.autoConfirmed) {
          setSuccess(
            "Settled immediately because a guest is involved. Group balances updated.",
          );
        } else {
          setSuccess(
            `Waiting for ${data.transfer.toDisplayName ?? "the receiver"} to confirm. Balances stay unchanged until then.`,
          );
        }
        setAmount("");
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (otherMembers.length === 0) {
    return (
      <p className="text-sm text-[#5a6072]">
        Add another member before recording a settlement.
      </p>
    );
  }

  const submitDisabled =
    loading ||
    (!senderIsGuest && senderIsSelf && links.length === 0) ||
    (!senderIsGuest && !senderIsSelf);

  const selectedFromLink = links.find(
    (link) => link.accountId === fromAccountId,
  );
  const parsedAmount = Number(amount);
  const senderWouldGoNegative =
    senderIsSelf &&
    !senderIsGuest &&
    selectedFromLink !== undefined &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    selectedFromLink.account.cachedBalance < parsedAmount;

  return (
    <form
      id="settlement-form"
      onSubmit={handleSubmit}
      className="scroll-mt-24 rounded-xl border border-[#e4e7ee] bg-white p-4 space-y-3"
      noValidate
    >
      <h3 className="text-sm font-semibold text-[#1a1d29]">Request settlement</h3>
      <p className="text-xs text-[#5a6072]">
        Registered ↔ registered stays pending until confirmed. Any transfer with
        a guest settles immediately.
      </p>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          {success}
        </div>
      ) : null}

      {senderIsGuest ? (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        >
          Recording a payment from guest{" "}
          <strong>{fromMember?.displayName}</strong>. This will settle
          immediately (no confirm step).
        </div>
      ) : null}

      {involvesGuest && !senderIsGuest ? (
        <p className="text-xs text-amber-800">
          Receiver is a guest — this will auto-confirm and debit your account
          now.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="settle-from"
            className="block text-xs font-semibold text-[#5a6072]"
          >
            Paid by
          </label>
          <select
            id="settle-from"
            value={fromMemberId}
            onChange={(event) => setFromMemberId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
          >
            {members.map((member) => (
              <option
                key={member.id}
                value={member.id}
                disabled={
                  member.memberType === "registered" &&
                  member.id !== currentMemberId
                }
              >
                {member.displayName}
                {member.id === currentMemberId ? " (you)" : ""}
                {member.memberType === "guest" ? " (guest)" : ""}
              </option>
            ))}
          </select>
          {fieldErrors.fromMemberId ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.fromMemberId}</p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor="settle-to"
            className="block text-xs font-semibold text-[#5a6072]"
          >
            Paid to
          </label>
          <select
            id="settle-to"
            value={effectiveToMemberId}
            onChange={(event) => setToMemberId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
            required
          >
            {toOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
                {member.memberType === "guest" ? " (guest)" : ""}
              </option>
            ))}
          </select>
          {fieldErrors.toMemberId ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.toMemberId}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label
          htmlFor="settle-amount"
          className="block text-xs font-semibold text-[#5a6072]"
        >
          Amount (PKR)
        </label>
        <input
          id="settle-amount"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
          required
        />
        {fieldErrors.amount ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.amount}</p>
        ) : null}
      </div>

      {!senderIsGuest ? (
        <div>
          <label
            htmlFor="settle-from-account"
            className="block text-xs font-semibold text-[#5a6072]"
          >
            From linked account
          </label>
          {linksLoading ? (
            <p className="mt-2 text-sm text-[#5a6072]">Loading accounts…</p>
          ) : links.length === 0 ? (
            <p className="mt-2 text-sm text-amber-800">
              Link a personal account to this group first.
            </p>
          ) : (
            <select
              id="settle-from-account"
              value={fromAccountId}
              onChange={(event) => setFromAccountId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
              required
            >
              {links.map((link) => (
                <option key={link.id} value={link.accountId}>
                  {link.account.name} ({ACCOUNT_TYPE_LABELS[link.account.type]})
                  {link.isPrimary ? " — default" : ""} —{" "}
                  {format(link.account.cachedBalance)}
                </option>
              ))}
            </select>
          )}
          {fieldErrors.fromAccountId ? (
            <p className="mt-1 text-xs text-red-600">
              {fieldErrors.fromAccountId}
            </p>
          ) : null}
          {senderWouldGoNegative ? (
            <p
              role="status"
              className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
            >
              This will leave{" "}
              <strong>{selectedFromLink?.account.name}</strong> negative
              {involvesGuest
                ? " when the settlement posts now"
                : " after the receiver confirms"}
              . Negative balances are allowed.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[#5a6072]">
          Guest sender — no account debit (bookkeeping / credit receiver only if
          registered).
        </p>
      )}

      <button
        type="submit"
        disabled={submitDisabled}
        className="rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae] disabled:opacity-70"
      >
        {loading
          ? "Saving…"
          : involvesGuest
            ? "Settle now"
            : "Request settlement"}
      </button>
    </form>
  );
}
