"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { ManualSplitInputs } from "@/components/groups/ManualSplitInputs";
import { SplitTypeToggle } from "@/components/groups/SplitTypeToggle";
import { ACCOUNT_TYPE_LABELS } from "@/lib/format";
import { roundAmount } from "@/lib/money";
import { equalShares, sharesRemaining, toPaisa } from "@/lib/splits";
import type { GroupExpensePublic, GroupExpenseSplitType } from "@/models/GroupExpense";
import type { GroupMemberPublic } from "@/models/GroupMember";
import type { GroupMemberAccountPublic } from "@/models/GroupMemberAccount";

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface GroupExpenseFormProps {
  groupId: string;
  groupName: string;
  members: GroupMemberPublic[];
  currentMemberId: string;
  mode?: "create" | "edit";
  expenseId?: string;
  initialExpense?: GroupExpensePublic;
}

function toDateInputValueFromIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return toDateInputValue(new Date());
  }
  return toDateInputValue(date);
}

export function GroupExpenseForm({
  groupId,
  groupName,
  members,
  currentMemberId,
  mode = "create",
  expenseId,
  initialExpense,
}: GroupExpenseFormProps) {
  const { format } = useMoney();
  const router = useRouter();
  const [description, setDescription] = useState(
    initialExpense?.description ?? "",
  );
  const [amount, setAmount] = useState(
    initialExpense ? String(initialExpense.amount) : "",
  );
  const [occurredAt, setOccurredAt] = useState(() =>
    initialExpense
      ? toDateInputValueFromIso(initialExpense.occurredAt)
      : toDateInputValue(new Date()),
  );
  const [payerMemberId, setPayerMemberId] = useState(
    initialExpense?.payerMemberId ?? currentMemberId,
  );
  const [payerAccountId, setPayerAccountId] = useState(
    initialExpense?.payerAccountId ?? "",
  );
  const [splitType, setSplitType] = useState<GroupExpenseSplitType>(
    initialExpense?.splitType ?? "equal",
  );
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(
    () =>
      new Set(
        initialExpense
          ? initialExpense.participants.map((p) => p.memberId)
          : members.map((member) => member.id),
      ),
  );
  const [manualShares, setManualShares] = useState<Record<string, string>>(
    () => {
      if (!initialExpense || initialExpense.splitType !== "manual") {
        return {};
      }
      const seeded: Record<string, string> = {};
      for (const participant of initialExpense.participants) {
        seeded[participant.memberId] = String(participant.shareAmount);
      }
      return seeded;
    },
  );
  const [ownLinks, setOwnLinks] = useState<GroupMemberAccountPublic[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const payer = members.find((member) => member.id === payerMemberId);
  const isOwnPayer = payerMemberId === currentMemberId;
  const isGuestPayer = payer?.memberType === "guest";

  useEffect(() => {
    let cancelled = false;

    async function loadOwnLinks() {
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
            const links = data.linkedAccounts ?? [];
            setOwnLinks(links);
            const primary =
              links.find((link) => link.isPrimary)?.accountId ??
              data.primaryAccountId ??
              links[0]?.accountId ??
              "";
            setPayerAccountId((current) => current || primary);
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

    void loadOwnLinks();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const amountNumber = Number(amount);
  const participantIds = useMemo(
    () => [...selectedParticipants],
    [selectedParticipants],
  );

  const effectivePayerAccountId = useMemo(() => {
    if (!isOwnPayer || isGuestPayer) {
      return "";
    }
    if (
      payerAccountId &&
      ownLinks.some((link) => link.accountId === payerAccountId)
    ) {
      return payerAccountId;
    }
    return (
      ownLinks.find((link) => link.isPrimary)?.accountId ??
      ownLinks[0]?.accountId ??
      ""
    );
  }, [isOwnPayer, isGuestPayer, payerAccountId, ownLinks]);

  const equalPreview = useMemo(() => {
    if (
      !Number.isFinite(amountNumber) ||
      amountNumber <= 0 ||
      participantIds.length === 0
    ) {
      return null;
    }
    try {
      return equalShares(amountNumber, participantIds);
    } catch {
      return null;
    }
  }, [amountNumber, participantIds]);

  const manualRemaining = useMemo(() => {
    if (
      splitType !== "manual" ||
      !Number.isFinite(amountNumber) ||
      amountNumber <= 0 ||
      participantIds.length === 0
    ) {
      return null;
    }
    const values = participantIds.map((id) => {
      const raw = Number(manualShares[id] ?? "");
      return Number.isFinite(raw) ? roundAmount(raw) : 0;
    });
    return sharesRemaining(amountNumber, values);
  }, [splitType, amountNumber, participantIds, manualShares]);

  const manualBalanced =
    manualRemaining !== null && toPaisa(manualRemaining) === 0;

  const selectedOwnAccount = ownLinks.find(
    (link) => link.accountId === effectivePayerAccountId,
  );

  const projectedBalance =
    isOwnPayer &&
    selectedOwnAccount &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0
      ? selectedOwnAccount.account.cachedBalance - amountNumber
      : null;

  const showNegativeWarning =
    projectedBalance !== null && projectedBalance < 0;

  function seedManualFromEqual() {
    if (
      !Number.isFinite(amountNumber) ||
      amountNumber <= 0 ||
      participantIds.length === 0
    ) {
      setManualShares({});
      return;
    }
    try {
      const shares = equalShares(amountNumber, participantIds);
      const next: Record<string, string> = {};
      for (const share of shares) {
        next[share.memberId] = String(share.shareAmount);
      }
      setManualShares(next);
    } catch {
      setManualShares({});
    }
  }

  function handleSplitTypeChange(next: GroupExpenseSplitType) {
    setSplitType(next);
    if (next === "manual") {
      seedManualFromEqual();
    }
  }

  function toggleParticipant(memberId: string) {
    const next = new Set(selectedParticipants);
    if (next.has(memberId)) {
      next.delete(memberId);
    } else {
      next.add(memberId);
    }
    setSelectedParticipants(next);

    if (splitType !== "manual") {
      return;
    }

    const ids = [...next];
    if (
      ids.length > 0 &&
      Number.isFinite(amountNumber) &&
      amountNumber > 0
    ) {
      try {
        const shares = equalShares(amountNumber, ids);
        const seeded: Record<string, string> = {};
        for (const share of shares) {
          seeded[share.memberId] = String(share.shareAmount);
        }
        setManualShares(seeded);
        return;
      } catch {
        /* fall through */
      }
    }

    setManualShares((current) => {
      const copy = { ...current };
      delete copy[memberId];
      return copy;
    });
  }

  async function submitExpense() {
    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const body: Record<string, unknown> = {
        description,
        amount: amountNumber,
        occurredAt,
        splitType,
        payerMemberId,
        participantMemberIds: participantIds,
      };

      if (splitType === "manual") {
        body.shares = participantIds.map((memberId) => ({
          memberId,
          amount: roundAmount(Number(manualShares[memberId])),
        }));
      }

      if (isOwnPayer && !isGuestPayer && effectivePayerAccountId) {
        body.payerAccountId = effectivePayerAccountId;
      }

      const response = await fetch(
        mode === "edit" && expenseId
          ? `/api/groups/${groupId}/expenses/${expenseId}`
          : `/api/groups/${groupId}/expenses`,
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        },
      );

      const data = (await response.json()) as {
        expense?: GroupExpensePublic;
        error?: string;
        fields?: Record<string, string>;
        code?: string;
        expected?: number;
        actual?: number;
      };

      if (!response.ok) {
        if (data.fields) {
          setFieldErrors(data.fields);
        }
        if (data.code === "SHARES_MUST_SUM_TO_TOTAL") {
          setError(
            data.error ??
              `Shares must sum to ${data.expected?.toFixed(2)} (got ${data.actual?.toFixed(2)}).`,
          );
        } else {
          setError(
            data.error ??
              (mode === "edit"
                ? "Unable to update group expense."
                : "Unable to create group expense."),
          );
        }
        setConfirmOpen(false);
        return;
      }

      if (mode === "edit" && expenseId) {
        router.push(`/groups/${groupId}/expenses/${expenseId}?updated=1`);
      } else {
        router.push(`/groups/${groupId}?expenseCreated=1`);
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setConfirmOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!description.trim()) {
      setFieldErrors({ description: "Description is required" });
      return;
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setFieldErrors({ amount: "Enter a valid amount" });
      return;
    }
    if (participantIds.length === 0) {
      setFieldErrors({ participantMemberIds: "Select at least one participant" });
      return;
    }
    if (splitType === "manual" && !manualBalanced) {
      setError("Manual shares must sum exactly to the total before submitting.");
      return;
    }
    if (isOwnPayer && !isGuestPayer && ownLinks.length === 0) {
      setError("Link a personal account to this group before paying.");
      return;
    }

    if (!isOwnPayer && !isGuestPayer) {
      setConfirmOpen(true);
      return;
    }

    void submitExpense();
  }

  const submitDisabled =
    loading || (splitType === "manual" && !manualBalanced);

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}

        {showNegativeWarning ? (
          <div
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          >
            This expense will put{" "}
            <strong>{selectedOwnAccount?.account.name}</strong> at{" "}
            {format(projectedBalance!)}{" "}
            (negative balance allowed).
          </div>
        ) : null}

        <div>
          <label
            htmlFor="group-expense-description"
            className="block text-sm font-semibold text-[#1a1d29]"
          >
            Description
          </label>
          <input
            id="group-expense-description"
            type="text"
            maxLength={200}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2.5 text-sm"
            required
          />
          {fieldErrors.description ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="group-expense-amount"
              className="block text-sm font-semibold text-[#1a1d29]"
            >
              Amount (PKR)
            </label>
            <input
              id="group-expense-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              onBlur={() => {
                if (splitType === "manual") {
                  seedManualFromEqual();
                }
              }}
              className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2.5 text-sm"
              required
            />
            {fieldErrors.amount ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.amount}</p>
            ) : null}
          </div>
          <div>
            <label
              htmlFor="group-expense-date"
              className="block text-sm font-semibold text-[#1a1d29]"
            >
              Date
            </label>
            <input
              id="group-expense-date"
              type="date"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2.5 text-sm"
              required
            />
            {fieldErrors.occurredAt ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.occurredAt}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="group-expense-payer"
              className="block text-sm font-semibold text-[#1a1d29]"
            >
              Paid by
            </label>
            <select
              id="group-expense-payer"
              value={payerMemberId}
              onChange={(event) => {
                setPayerMemberId(event.target.value);
                setPayerAccountId("");
              }}
              className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2.5 text-sm"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                  {member.memberType === "guest" ? " (guest)" : ""}
                  {member.id === currentMemberId ? " (you)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="group-expense-account"
              className="block text-sm font-semibold text-[#1a1d29]"
            >
              Payer account
            </label>
            {isGuestPayer ? (
              <p className="mt-2 text-sm text-[#5a6072]">
                Guest payer — bookkeeping only (no account debit).
              </p>
            ) : isOwnPayer ? (
              linksLoading ? (
                <p className="mt-2 text-sm text-[#5a6072]">Loading accounts…</p>
              ) : ownLinks.length === 0 ? (
                <p className="mt-2 text-sm text-amber-800">
                  <Link
                    href={`/groups/${groupId}`}
                    className="font-medium text-[#2f5fdc] hover:underline"
                  >
                    Link an account
                  </Link>{" "}
                  on the group page first.
                </p>
              ) : (
                <select
                  id="group-expense-account"
                  value={effectivePayerAccountId}
                  onChange={(event) => setPayerAccountId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2.5 text-sm"
                  required
                >
                  {ownLinks.map((link) => (
                    <option key={link.id} value={link.accountId}>
                      {link.account.name} ({ACCOUNT_TYPE_LABELS[link.account.type]})
                      {link.isPrimary ? " — default" : ""} —{" "}
                      {format(link.account.cachedBalance)}
                    </option>
                  ))}
                </select>
              )
            ) : (
              <p className="mt-2 text-sm text-[#5a6072]">
                Uses {payer?.displayName ?? "their"} default linked account for{" "}
                {groupName}.
              </p>
            )}
            {fieldErrors.payerAccountId ? (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.payerAccountId}
              </p>
            ) : null}
          </div>
        </div>

        <SplitTypeToggle value={splitType} onChange={handleSplitTypeChange} />

        <fieldset>
          <legend className="text-sm font-semibold text-[#1a1d29]">
            {splitType === "equal" ? "Split equally among" : "Split manually among"}
          </legend>

          {splitType === "equal" ? (
            <>
              <ul className="mt-3 space-y-2">
                {members.map((member) => {
                  const checked = selectedParticipants.has(member.id);
                  const share = equalPreview?.find(
                    (row) => row.memberId === member.id,
                  );
                  return (
                    <li key={member.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#e4e7ee] px-3 py-2.5 hover:bg-[#fafbfd]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleParticipant(member.id)}
                        />
                        <span className="min-w-0 flex-1 text-sm text-[#1a1d29]">
                          {member.displayName}
                          {member.memberType === "guest" ? (
                            <span className="text-[#5a6072]"> · guest</span>
                          ) : null}
                        </span>
                        {checked && share ? (
                          <span className="text-sm font-medium text-[#5a6072]">
                            {format(share.shareAmount)}
                          </span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
              {equalPreview && equalPreview.length > 0 ? (
                <p className="mt-3 text-sm text-[#5a6072]" role="status">
                  {format(equalPreview[0]!.shareAmount)} each
                  {equalPreview.some(
                    (row) =>
                      row.shareAmount !== equalPreview[0]!.shareAmount,
                  )
                    ? " (remainder distributed so shares sum to the total)"
                    : ""}
                  {" · "}
                  {equalPreview.length} participant
                  {equalPreview.length === 1 ? "" : "s"}
                </p>
              ) : null}
            </>
          ) : (
            <div className="mt-3">
              <ManualSplitInputs
                members={members}
                selectedIds={selectedParticipants}
                shareInputs={manualShares}
                totalAmount={amountNumber}
                onShareChange={(memberId, value) =>
                  setManualShares((current) => ({
                    ...current,
                    [memberId]: value,
                  }))
                }
                onToggleParticipant={toggleParticipant}
              />
            </div>
          )}

          {fieldErrors.participantMemberIds ? (
            <p className="mt-1 text-xs text-red-600">
              {fieldErrors.participantMemberIds}
            </p>
          ) : null}
          {fieldErrors.shares ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.shares}</p>
          ) : null}
        </fieldset>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href={
              mode === "edit" && expenseId
                ? `/groups/${groupId}/expenses/${expenseId}`
                : `/groups/${groupId}`
            }
            className="inline-flex justify-center rounded-lg border border-[#e4e7ee] px-4 py-2.5 text-sm font-medium text-[#1a1d29] hover:bg-[#f5f6f9]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitDisabled}
            className="rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae] disabled:opacity-70"
          >
            {loading
              ? "Saving…"
              : mode === "edit"
                ? "Save changes"
                : "Add group expense"}
          </button>
        </div>
      </form>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              if (!loading) {
                setConfirmOpen(false);
              }
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="debit-other-title"
            className="relative w-full max-w-md rounded-xl border border-[#e4e7ee] bg-white p-6 shadow-lg"
          >
            <h2
              id="debit-other-title"
              className="text-lg font-bold text-[#1a1d29]"
            >
              Debit another member’s account?
            </h2>
            <p className="mt-2 text-sm text-[#5a6072]">
              This will debit <strong>{payer?.displayName}</strong>
              ’s linked account for{" "}
              <strong>
                {Number.isFinite(amountNumber)
                  ? format(amountNumber)
                  : "this expense"}
              </strong>
              , not yours.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={loading}
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-[#e4e7ee] px-4 py-2.5 text-sm font-medium text-[#1a1d29] hover:bg-[#f5f6f9] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || (splitType === "manual" && !manualBalanced)}
                onClick={() => void submitExpense()}
                className="rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae] disabled:opacity-60"
              >
                {loading ? "Saving…" : "Confirm debit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
