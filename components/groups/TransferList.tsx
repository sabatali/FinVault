"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  SettlementForm,
  type SettlementPrefill,
} from "@/components/groups/SettlementForm";
import type { GroupMemberPublic } from "@/models/GroupMember";
import type { GroupMemberAccountPublic } from "@/models/GroupMemberAccount";
import type {
  GroupTransferPublic,
  GroupTransferStatus,
} from "@/models/GroupTransfer";

interface TransferListProps {
  groupId: string;
  currentMemberId: string;
  members: GroupMemberPublic[];
  initialTransfers: GroupTransferPublic[];
  ownLinks: GroupMemberAccountPublic[];
}

function statusLabel(status: GroupTransferStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "rejected":
      return "Rejected";
    case "auto_confirmed":
      return "Auto-confirmed (guest)";
    default:
      return status;
  }
}

function statusClass(status: GroupTransferStatus): string {
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-900";
    case "confirmed":
    case "auto_confirmed":
      return "bg-emerald-50 text-emerald-800";
    case "rejected":
      return "bg-red-50 text-red-800";
    default:
      return "bg-[#eef1f8] text-[#5a6072]";
  }
}

export function TransferList({
  groupId,
  currentMemberId,
  members,
  initialTransfers,
  ownLinks,
}: TransferListProps) {
  const { format } = useMoney();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [transfers, setTransfers] = useState(initialTransfers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAccountId, setConfirmAccountId] = useState(
    () =>
      ownLinks.find((link) => link.isPrimary)?.accountId ??
      ownLinks[0]?.accountId ??
      "",
  );

  const prefill = useMemo((): SettlementPrefill | null => {
    const settleFrom = searchParams.get("settleFrom");
    const settleTo = searchParams.get("settleTo");
    const settleAmount = searchParams.get("settleAmount");
    if (!settleFrom || !settleTo || !settleAmount) {
      return null;
    }
    const fromExists = members.some((member) => member.id === settleFrom);
    const toExists = members.some((member) => member.id === settleTo);
    if (!fromExists || !toExists) {
      return null;
    }
    return {
      fromMemberId: settleFrom,
      toMemberId: settleTo,
      amount: settleAmount,
    };
  }, [searchParams, members]);

  const prefillKey = prefill
    ? `${prefill.fromMemberId}:${prefill.toMemberId}:${prefill.amount}`
    : "default";

  function clearSettleQuery() {
    if (
      !searchParams.get("settleFrom") &&
      !searchParams.get("settleTo") &&
      !searchParams.get("settleAmount")
    ) {
      return;
    }
    const next = new URLSearchParams(searchParams.toString());
    next.delete("settleFrom");
    next.delete("settleTo");
    next.delete("settleAmount");
    const query = next.toString();
    router.replace(query ? `/groups/${groupId}?${query}` : `/groups/${groupId}`, {
      scroll: false,
    });
  }

  const incomingPending = useMemo(
    () =>
      transfers.filter(
        (transfer) =>
          transfer.status === "pending" &&
          transfer.toMemberId === currentMemberId,
      ),
    [transfers, currentMemberId],
  );

  async function confirmTransfer(transfer: GroupTransferPublic) {
    setBusyId(transfer.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/groups/${groupId}/transfers/${transfer.id}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(
            confirmAccountId ? { toAccountId: confirmAccountId } : {},
          ),
        },
      );
      const data = (await response.json()) as {
        transfer?: GroupTransferPublic;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Unable to confirm.");
        return;
      }
      if (data.transfer) {
        setTransfers((current) =>
          current.map((item) =>
            item.id === data.transfer!.id ? data.transfer! : item,
          ),
        );
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function rejectTransfer(transfer: GroupTransferPublic) {
    setBusyId(transfer.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/groups/${groupId}/transfers/${transfer.id}/reject`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = (await response.json()) as {
        transfer?: GroupTransferPublic;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Unable to reject.");
        return;
      }
      if (data.transfer) {
        setTransfers((current) =>
          current.map((item) =>
            item.id === data.transfer!.id ? data.transfer! : item,
          ),
        );
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelTransfer(transfer: GroupTransferPublic) {
    setBusyId(transfer.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/groups/${groupId}/transfers/${transfer.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to cancel.");
        return;
      }
      setTransfers((current) =>
        current.filter((item) => item.id !== transfer.id),
      );
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {incomingPending.length > 0 ? (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          You have {incomingPending.length} incoming settlement
          {incomingPending.length === 1 ? "" : "s"} waiting for confirmation.
          Group nets stay unchanged until you confirm.
        </div>
      ) : null}

      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-xl border border-[#e4e7ee] bg-[#eef1f8]" />
        }
      >
        <SettlementForm
          key={prefillKey}
          groupId={groupId}
          members={members}
          currentMemberId={currentMemberId}
          prefill={prefill}
          onCreated={(transfer) => {
            setTransfers((current) => [transfer, ...current]);
            clearSettleQuery();
          }}
        />
      </Suspense>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {transfers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e4e7ee] bg-[#fafbfd] px-4 py-4 text-center text-sm text-[#5a6072]">
          No settlements yet.
        </div>
      ) : (
        <ul className="divide-y divide-[#e4e7ee] overflow-hidden rounded-xl border border-[#e4e7ee] bg-white">
          {transfers.map((transfer) => {
            const isIncoming =
              transfer.toMemberId === currentMemberId &&
              transfer.status === "pending";
            const isOutgoing =
              transfer.fromMemberId === currentMemberId &&
              transfer.status === "pending";
            const fromName = transfer.fromDisplayName ?? "Member";
            const toName = transfer.toDisplayName ?? "Member";

            return (
              <li key={transfer.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#1a1d29]">
                        {fromName} → {toName}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(transfer.status)}`}
                      >
                        {statusLabel(transfer.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[#5a6072]">
                      {format(transfer.amount)}
                      {transfer.fromAccountName
                        ? ` · from ${transfer.fromAccountName}`
                        : ""}
                      {transfer.status === "pending"
                        ? ` · Waiting for ${toName} to confirm — balances unchanged`
                        : ""}
                      {transfer.status === "auto_confirmed"
                        ? " · Settled immediately (guest involved)"
                        : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-bold text-[#1a1d29]">
                    {format(transfer.amount)}
                  </p>
                </div>

                {isIncoming ? (
                  <div className="space-y-2">
                    <p className="text-sm text-[#1a1d29]">
                      Your balance will increase by{" "}
                      <strong>
                        {format(transfer.amount)}
                      </strong>
                      .
                    </p>
                    {transfer.senderWouldGoNegative ? (
                      <p
                        role="status"
                        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                      >
                        Warning: {fromName}&apos;s sending account balance is
                        lower than this amount and will go negative. That is
                        allowed.
                      </p>
                    ) : null}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      {ownLinks.length > 0 ? (
                        <div className="min-w-0 flex-1">
                          <label
                            htmlFor={`confirm-account-${transfer.id}`}
                            className="block text-xs font-semibold text-[#5a6072]"
                          >
                            Credit to
                          </label>
                          <select
                            id={`confirm-account-${transfer.id}`}
                            value={confirmAccountId}
                            onChange={(event) =>
                              setConfirmAccountId(event.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
                          >
                            {ownLinks.map((link) => (
                              <option key={link.id} value={link.accountId}>
                                {link.account.name}
                                {link.isPrimary ? " — default" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <p className="text-sm text-amber-800">
                          Link an account to confirm this settlement.
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={
                            busyId === transfer.id || ownLinks.length === 0
                          }
                          aria-label={`Confirm receipt of ${format(transfer.amount)} from ${fromName}`}
                          onClick={() => void confirmTransfer(transfer)}
                          className="rounded-lg bg-[#2f5fdc] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1e3fae] disabled:opacity-60"
                        >
                          {busyId === transfer.id ? "Working…" : "Confirm"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === transfer.id}
                          aria-label={`Reject settlement of ${format(transfer.amount)} from ${fromName}`}
                          onClick={() => void rejectTransfer(transfer)}
                          className="rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {isOutgoing ? (
                  <button
                    type="button"
                    disabled={busyId === transfer.id}
                    onClick={() => void cancelTransfer(transfer)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    {busyId === transfer.id ? "Cancelling…" : "Cancel request"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TransferListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-28 rounded-xl border border-[#e4e7ee] bg-[#eef1f8]" />
      <div className="h-20 rounded-xl border border-[#e4e7ee] bg-[#eef1f8]" />
    </div>
  );
}
