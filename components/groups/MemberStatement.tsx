"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useMoney } from "@/components/currency/CurrencyProvider";
import type { MemberStatement as MemberStatementData, StatementRow } from "@/lib/group-statement";

interface MemberStatementProps {
  groupId: string;
  memberName: string;
  members: Array<{ memberId: string; displayName: string }>;
  selectedMemberId: string;
  statement: MemberStatementData;
  from?: string;
  to?: string;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function rowHref(groupId: string, row: StatementRow): string {
  if (row.kind === "expense_paid" || row.kind === "expense_share") {
    return `/groups/${groupId}/expenses/${row.refId}`;
  }
  return `/groups/${groupId}?tab=settlements`;
}

function downloadCsv(
  memberName: string,
  rows: StatementRow[],
  format: (amount: number) => string,
) {
  const header = [
    "Date",
    "Kind",
    "Description",
    "Counterparty",
    "Paid",
    "Share",
    "Effect",
    "Running",
    "Status",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        formatDate(row.date),
        row.kind,
        `"${row.description.replaceAll('"', '""')}"`,
        row.counterparty ?? "",
        format(row.paid),
        format(row.share),
        format(row.effect),
        format(row.runningBalance),
        row.status ?? "",
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${memberName.replaceAll(" ", "-")}-statement.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function MemberStatement({
  groupId,
  memberName,
  members,
  selectedMemberId,
  statement,
  from = "",
  to = "",
}: MemberStatementProps) {
  const { format } = useMoney();
  const filterAction = `/groups/${groupId}/statement`;

  const dateInputs = useMemo(
    () => ({
      from: from.slice(0, 10),
      to: to.slice(0, 10),
    }),
    [from, to],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1d29]">
            Statement · {memberName}
          </h2>
          <p className="mt-1 text-sm text-[#5a6072]">
            Running balance ends at {format(statement.closingBalance)}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv(memberName, statement.rows, format)}
          className="rounded-lg border border-[#e4e7ee] bg-white px-4 py-2.5 text-sm font-semibold text-[#1a1d29] hover:bg-[#f4f6fb]"
        >
          Download CSV
        </button>
      </div>

      <form
        method="get"
        action={filterAction}
        className="grid gap-3 rounded-xl border border-[#e4e7ee] bg-white p-4 sm:grid-cols-3"
      >
        <label className="text-sm text-[#5a6072]">
          Member
          <select
            name="member"
            defaultValue={selectedMemberId}
            className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-[#1a1d29]"
          >
            {members.map((member) => (
              <option key={member.memberId} value={member.memberId}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-[#5a6072]">
          From
          <input
            type="date"
            name="from"
            defaultValue={dateInputs.from}
            className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-[#1a1d29]"
          />
        </label>
        <label className="text-sm text-[#5a6072]">
          To
          <input
            type="date"
            name="to"
            defaultValue={dateInputs.to}
            className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-[#1a1d29]"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae] sm:col-span-3"
        >
          Apply
        </button>
      </form>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Paid", statement.totals.paid],
          ["Share", statement.totals.share],
          ["Settlements sent", statement.totals.settlementsSent],
          ["Balance", statement.closingBalance],
        ].map(([label, amount]) => (
          <div
            key={label}
            className="rounded-xl border border-[#e4e7ee] bg-white px-3 py-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[#5a6072]">
              {label}
            </p>
            <p className="mt-1 text-sm font-bold text-[#1a1d29]">
              {format(amount as number)}
            </p>
          </div>
        ))}
      </div>

      {statement.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#e4e7ee] bg-[#fafbfd] px-4 py-8 text-center text-sm text-[#5a6072]">
          No statement rows in this range.
        </p>
      ) : (
        <ul className="divide-y divide-[#e4e7ee] overflow-hidden rounded-xl border border-[#e4e7ee] bg-white md:hidden">
          {statement.rows.map((row) => (
            <li key={`${row.kind}-${row.refId}-${row.date}`}>
              <Link
                href={rowHref(groupId, row)}
                className={`block px-4 py-3 ${
                  row.status === "pending" ? "bg-[#f4f6fb] text-[#5a6072]" : ""
                }`}
              >
                <p className="text-xs text-[#5a6072]">{formatDate(row.date)}</p>
                <p className="mt-0.5 font-medium text-[#1a1d29]">
                  {row.description}
                </p>
                <p className="mt-1 text-sm text-[#5a6072]">
                  Effect {format(row.effect)} · Balance{" "}
                  {format(row.runningBalance)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {statement.rows.length > 0 ? (
        <div className="hidden overflow-hidden rounded-xl border border-[#e4e7ee] bg-white md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f4f6fb] text-[#5a6072]">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium text-right">Paid</th>
                <th className="px-4 py-2 font-medium text-right">Share</th>
                <th className="px-4 py-2 font-medium text-right">Effect</th>
                <th className="px-4 py-2 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e7ee]">
              {statement.rows.map((row) => (
                <tr
                  key={`${row.kind}-${row.refId}-${row.date}`}
                  className={row.status === "pending" ? "bg-[#f4f6fb] text-[#5a6072]" : ""}
                >
                  <td className="px-4 py-2 text-[#5a6072]">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={rowHref(groupId, row)}
                      className="font-medium text-[#2f5fdc] hover:underline"
                    >
                      {row.description}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right">{format(row.paid)}</td>
                  <td className="px-4 py-2 text-right">{format(row.share)}</td>
                  <td className="px-4 py-2 text-right">{format(row.effect)}</td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {format(row.runningBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
