"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { ACCOUNT_TYPE_LABELS } from "@/lib/format";
import type { AccountPublic } from "@/models/Account";
import type { GroupMemberAccountPublic } from "@/models/GroupMemberAccount";

interface LinkedAccountsProps {
  groupId: string;
  initialLinks: GroupMemberAccountPublic[];
}

export function LinkedAccounts({ groupId, initialLinks }: LinkedAccountsProps) {
  const { format } = useMoney();
  const [links, setLinks] = useState(initialLinks);
  const [accounts, setAccounts] = useState<AccountPublic[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [primaryBusy, setPrimaryBusy] = useState(false);
  const [unlinkId, setUnlinkId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState<GroupMemberAccountPublic | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAccounts() {
      setAccountsLoading(true);
      try {
        const response = await fetch("/api/accounts", { credentials: "include" });
        const data = (await response.json()) as {
          accounts?: AccountPublic[];
          error?: string;
        };
        if (!cancelled) {
          if (response.ok && data.accounts) {
            setAccounts(data.accounts);
          } else {
            setError(data.error ?? "Unable to load your accounts.");
          }
        }
      } catch {
        if (!cancelled) {
          setError("Network error loading accounts.");
        }
      } finally {
        if (!cancelled) {
          setAccountsLoading(false);
        }
      }
    }

    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, []);

  const linkedAccountIds = useMemo(
    () => new Set(links.map((link) => link.accountId)),
    [links],
  );

  const availableAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.currency === "PKR" && !linkedAccountIds.has(account.id),
      ),
    [accounts, linkedAccountIds],
  );

  const primaryAccountId =
    links.find((link) => link.isPrimary)?.accountId ?? "";

  async function refreshLinks() {
    const response = await fetch(`/api/groups/${groupId}/linked-accounts`, {
      credentials: "include",
    });
    const data = (await response.json()) as {
      linkedAccounts?: GroupMemberAccountPublic[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error ?? "Unable to refresh linked accounts.");
    }
    setLinks(data.linkedAccounts ?? []);
  }

  async function handleLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccountId) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/groups/${groupId}/linked-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accountId: selectedAccountId }),
      });
      const data = (await response.json()) as {
        linkedAccount?: GroupMemberAccountPublic;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Unable to link account.");
        return;
      }

      if (data.linkedAccount) {
        setLinks((current) => [...current, data.linkedAccount!]);
        setSelectedAccountId("");
        if (data.linkedAccount.isPrimary) {
          setSuccess(
            `${data.linkedAccount.account.name} is your default for this group.`,
          );
        }
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPrimary(accountId: string) {
    const target = links.find((link) => link.accountId === accountId);
    if (!target || target.isPrimary) {
      return;
    }

    setPrimaryBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/groups/${groupId}/primary-account`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accountId }),
      });
      const data = (await response.json()) as {
        primaryAccountId?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Unable to set default account.");
        return;
      }

      setLinks((current) =>
        current.map((link) => ({
          ...link,
          isPrimary: link.accountId === accountId,
        })),
      );
      setSuccess(`${target.account.name} is your default for this group.`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPrimaryBusy(false);
    }
  }

  async function handleUnlinkConfirm() {
    if (!confirmUnlink) {
      return;
    }

    setUnlinkId(confirmUnlink.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/groups/${groupId}/linked-accounts/${confirmUnlink.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Unable to unlink account.");
        return;
      }

      await refreshLinks();
      setConfirmUnlink(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUnlinkId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {success}
        </div>
      ) : null}

      {links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e4e7ee] bg-[#fafbfd] px-4 py-4 text-sm text-[#5a6072]">
          Link a personal account so group expenses can debit real money.
        </div>
      ) : (
        <fieldset
          disabled={primaryBusy || Boolean(unlinkId)}
          className="divide-y divide-[#e4e7ee] overflow-hidden rounded-xl border border-[#e4e7ee] bg-white disabled:opacity-80"
        >
          <legend className="sr-only">
            Default account for group expenses
          </legend>
          <div className="border-b border-[#e4e7ee] bg-[#fafbfd] px-4 py-3">
            <p className="text-sm font-semibold text-[#1a1d29]">
              Default account for group expenses
            </p>
            <p className="mt-0.5 text-xs text-[#5a6072]">
              New shared expenses will start with this account selected.
            </p>
          </div>
          {links.map((link) => {
            const balance = link.account.cachedBalance;
            const negative = balance < 0;
            const radioId = `primary-${link.id}`;

            return (
              <div
                key={link.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <input
                    id={radioId}
                    type="radio"
                    name="primary-account"
                    className="mt-1"
                    checked={link.accountId === primaryAccountId}
                    onChange={() => void handleSetPrimary(link.accountId)}
                    aria-label={`Make ${link.account.name} the default`}
                  />
                  <label htmlFor={radioId} className="min-w-0 cursor-pointer">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#1a1d29]">
                        {link.account.name}
                      </p>
                      <span className="rounded-full bg-[#eef1f8] px-2 py-0.5 text-xs font-medium text-[#5a6072]">
                        {ACCOUNT_TYPE_LABELS[link.account.type]}
                      </span>
                      {link.isPrimary ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Default
                        </span>
                      ) : null}
                    </div>
                    <p
                      className={`mt-1 text-sm ${negative ? "text-red-600" : "text-[#5a6072]"}`}
                      aria-label={
                        negative
                          ? `Negative balance: ${format(balance)}`
                          : undefined
                      }
                    >
                      {format(balance)}
                    </p>
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {!link.isPrimary ? (
                    <button
                      type="button"
                      disabled={primaryBusy}
                      onClick={() => void handleSetPrimary(link.accountId)}
                      className="rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm font-medium text-[#2f5fdc] hover:bg-[#eef1f8] disabled:opacity-60"
                    >
                      Make default
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Unlink ${link.account.name}`}
                    disabled={unlinkId === link.id}
                    onClick={() => setConfirmUnlink(link)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Unlink
                  </button>
                </div>
              </div>
            );
          })}
        </fieldset>
      )}

      {links.length === 0 ? (
        <p className="text-xs text-amber-800">
          Link an account before adding group expenses.
        </p>
      ) : null}

      <form
        onSubmit={handleLink}
        className="rounded-xl border border-[#e4e7ee] bg-white p-4 space-y-3"
      >
        <h3 className="text-sm font-semibold text-[#1a1d29]">Link account</h3>
        {accountsLoading ? (
          <p className="text-sm text-[#5a6072]">Loading your accounts…</p>
        ) : availableAccounts.length === 0 ? (
          <p className="text-sm text-[#5a6072]">
            {accounts.length === 0
              ? "Create a personal account first, then link it here."
              : "All of your PKR accounts are already linked to this group."}
          </p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="link-account-select"
                className="block text-xs font-semibold text-[#5a6072]"
              >
                Account
              </label>
              <select
                id="link-account-select"
                value={selectedAccountId}
                onChange={(event) => setSelectedAccountId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
                required
              >
                <option value="">Select an account</option>
                {availableAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({ACCOUNT_TYPE_LABELS[account.type]}) —{" "}
                    {format(account.cachedBalance)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={loading || !selectedAccountId}
              className="rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae] disabled:opacity-70"
            >
              {loading ? "Linking…" : "Link account"}
            </button>
          </div>
        )}
      </form>

      {confirmUnlink ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              if (!unlinkId) {
                setConfirmUnlink(null);
              }
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unlink-account-title"
            className="relative w-full max-w-md rounded-xl border border-[#e4e7ee] bg-white p-6 shadow-lg"
          >
            <h2
              id="unlink-account-title"
              className="text-lg font-bold text-[#1a1d29]"
            >
              Unlink account?
            </h2>
            <p className="mt-2 text-sm text-[#5a6072]">
              Remove <strong>{confirmUnlink.account.name}</strong> from this
              group? You can link it again later.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={Boolean(unlinkId)}
                onClick={() => setConfirmUnlink(null)}
                className="rounded-lg border border-[#e4e7ee] px-4 py-2.5 text-sm font-medium text-[#1a1d29] hover:bg-[#f5f6f9] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(unlinkId)}
                onClick={() => void handleUnlinkConfirm()}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {unlinkId ? "Unlinking…" : "Unlink"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function LinkedAccountsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-20 rounded-xl border border-[#e4e7ee] bg-[#eef1f8]" />
      <div className="h-28 rounded-xl border border-[#e4e7ee] bg-[#eef1f8]" />
    </div>
  );
}
