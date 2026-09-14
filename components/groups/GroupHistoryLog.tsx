"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useMoney } from "@/components/currency/CurrencyProvider";
import {
  EMPTY_GROUP_ACTIVITY_FILTERS,
  expenseOweLines,
  filterGroupActivity,
  hasActiveGroupActivityFilters,
  splitTypeLabel,
  transferHeadline,
  transferStatusLabel,
  viewerSignedDelta,
  type GroupActivityEvent,
  type GroupActivityFilters,
  type GroupActivityStatusFilter,
  type GroupActivityTypeFilter,
} from "@/lib/group-activity";
import { OWED_EN_UR, OWES_EN_UR } from "@/lib/owes-labels";
import { toPaisa } from "@/lib/splits";
import type { GroupMemberPublic } from "@/models/GroupMember";
import type { GroupTransferStatus } from "@/models/GroupTransfer";

interface GroupHistoryLogProps {
  groupId: string;
  currentMemberId: string;
  members: GroupMemberPublic[];
  events: GroupActivityEvent[];
}

function formatActivityAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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

function signedClass(delta: number): string {
  const paisa = toPaisa(delta);
  if (paisa === 0) {
    return "text-[#5a6072]";
  }
  return paisa > 0 ? "text-emerald-700" : "text-red-700";
}

export function GroupHistoryLog({
  groupId,
  currentMemberId,
  members,
  events,
}: GroupHistoryLogProps) {
  const { format } = useMoney();
  const [filters, setFilters] = useState<GroupActivityFilters>(
    EMPTY_GROUP_ACTIVITY_FILTERS,
  );

  const viewedMemberId = filters.memberId || currentMemberId;
  const viewedMember = members.find((member) => member.id === viewedMemberId);
  const viewedName = viewedMember?.displayName ?? "you";

  const filtered = useMemo(
    () => filterGroupActivity(events, filters),
    [events, filters],
  );

  const filtersActive = hasActiveGroupActivityFilters(filters);

  function updateFilter<K extends keyof GroupActivityFilters>(
    key: K,
    value: GroupActivityFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_GROUP_ACTIVITY_FILTERS);
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e4e7ee] bg-[#fafbfd] px-4 py-10 text-center">
        <p className="text-sm font-medium text-[#1a1d29]">No activity yet</p>
        <p className="mt-1 text-sm text-[#5a6072]">
          Shared expenses and settlements will show up here as a running log —
          including pending transfers that have not changed the balance yet.
        </p>
        <Link
          href={`/groups/${groupId}/expenses/new`}
          className="mt-4 inline-flex text-sm font-semibold text-[#2f5fdc] hover:underline"
        >
          Add the first expense
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#e4e7ee] bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div>
            <label
              htmlFor="history-from"
              className="block text-xs font-semibold text-[#5a6072]"
            >
              From
            </label>
            <input
              id="history-from"
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="history-to"
              className="block text-xs font-semibold text-[#5a6072]"
            >
              To
            </label>
            <input
              id="history-to"
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="history-member"
              className="block text-xs font-semibold text-[#5a6072]"
            >
              Member
            </label>
            <select
              id="history-member"
              value={filters.memberId}
              onChange={(event) => updateFilter("memberId", event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
            >
              <option value="">All members</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                  {member.id === currentMemberId ? " (you)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="history-type"
              className="block text-xs font-semibold text-[#5a6072]"
            >
              Type
            </label>
            <select
              id="history-type"
              value={filters.type}
              onChange={(event) =>
                updateFilter(
                  "type",
                  event.target.value as GroupActivityTypeFilter,
                )
              }
              className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="history-status"
              className="block text-xs font-semibold text-[#5a6072]"
            >
              Status
            </label>
            <select
              id="history-status"
              value={filters.status}
              onChange={(event) =>
                updateFilter(
                  "status",
                  event.target.value as GroupActivityStatusFilter,
                )
              }
              className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        {filtersActive ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#5a6072]">
              Filters combine (AND). Confirmed includes auto-confirmed
              transfers.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-semibold text-[#2f5fdc] hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </div>

      <p className="text-sm text-[#5a6072]">
        Newest first. Green + is received or {OWED_EN_UR}. Red − is paid or{" "}
        {OWES_EN_UR}. Amounts are from {viewedName}&apos;s perspective.
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e4e7ee] bg-[#fafbfd] px-4 py-10 text-center">
          <p className="text-sm font-medium text-[#1a1d29]">
            No results for these filters
          </p>
          <p className="mt-1 text-sm text-[#5a6072]">
            Try a wider date range, another member, or a different type/status.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 inline-flex rounded-lg border border-[#e4e7ee] bg-white px-4 py-2.5 text-sm font-semibold text-[#1a1d29] hover:bg-[#f4f6fb]"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-[#e4e7ee] overflow-hidden rounded-xl border border-[#e4e7ee] bg-white">
          {filtered.map((event) => {
            const delta = viewerSignedDelta(event, viewedMemberId);
            const paisa = toPaisa(delta);
            const signedLabel =
              paisa === 0
                ? format(0)
                : `${paisa > 0 ? "+" : "−"}${format(Math.abs(delta))}`;

            if (event.kind === "expense") {
              const { expense } = event;
              const shareSummary = expense.participants
                .map((participant) => {
                  const name = participant.displayName ?? "Member";
                  return `${name} ${format(participant.shareAmount)}`;
                })
                .join(" · ");
              const oweLines = expenseOweLines(expense, format);

              return (
                <li key={`expense-${event.id}`} className="px-4 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#1a1d29]">
                          <Link
                            href={`/groups/${groupId}/expenses/${expense.id}`}
                            className="hover:text-[#2f5fdc] hover:underline"
                          >
                            {expense.description}
                          </Link>
                        </p>
                        <span className="rounded-full bg-[#eef1f8] px-2 py-0.5 text-xs font-medium text-[#5a6072]">
                          Expense
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[#5a6072]">
                        {formatActivityAt(event.at)}
                        {" · Paid by "}
                        {expense.payerDisplayName ?? "Member"}
                        {" · "}
                        {splitTypeLabel(expense.splitType)}
                        {" · Total "}
                        {format(expense.amount)}
                      </p>
                      <p className="mt-1 text-xs text-[#5a6072]">
                        Shares: {shareSummary}
                      </p>
                      {oweLines.length > 0 ? (
                        <ul className="mt-2 space-y-0.5">
                          {oweLines.map((line) => (
                            <li
                              key={line}
                              className="text-sm text-[#1a1d29]"
                            >
                              {line}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <p
                      className={`shrink-0 text-base font-bold ${signedClass(delta)}`}
                      aria-label={signedLabel}
                    >
                      {signedLabel}
                    </p>
                  </div>
                </li>
              );
            }

            const { transfer } = event;
            const headline = transferHeadline(transfer, viewedMemberId, format);
            const pendingNote =
              transfer.status === "pending"
                ? `Waiting for ${transfer.toDisplayName ?? "the receiver"} to confirm — not in the final balance yet`
                : transfer.status === "rejected"
                  ? "Rejected — did not change balances"
                  : transfer.status === "auto_confirmed"
                    ? "Auto-confirmed (guest involved)"
                    : null;

            return (
              <li key={`transfer-${event.id}`} className="px-4 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#1a1d29]">{headline}</p>
                      <span className="rounded-full bg-[#eef1f8] px-2 py-0.5 text-xs font-medium text-[#5a6072]">
                        Transfer
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(transfer.status)}`}
                      >
                        {transferStatusLabel(transfer.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[#5a6072]">
                      {formatActivityAt(event.at)}
                      {transfer.fromAccountName
                        ? ` · from ${transfer.fromAccountName}`
                        : ""}
                      {transfer.toAccountName
                        ? ` · to ${transfer.toAccountName}`
                        : ""}
                    </p>
                    {pendingNote ? (
                      <p className="mt-1 text-xs text-[#5a6072]">{pendingNote}</p>
                    ) : null}
                  </div>
                  <p
                    className={`shrink-0 text-base font-bold ${signedClass(delta)}`}
                    aria-label={signedLabel}
                  >
                    {signedLabel}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function GroupHistoryLogSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-xl border border-[#e4e7ee] bg-[#eef1f8]" />
      <div className="h-40 rounded-xl border border-[#e4e7ee] bg-[#eef1f8]" />
    </div>
  );
}
