"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DeleteAccountDialog } from "@/components/accounts/DeleteAccountDialog";
import { ACCOUNT_TYPE_LABELS } from "@/lib/format";
import type { AccountPublic } from "@/models/Account";

function AccountListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="hidden h-12 rounded-lg bg-[#e4e7ee] md:block" />
      <div className="h-24 rounded-xl bg-[#e4e7ee] md:h-16" />
      <div className="h-24 rounded-xl bg-[#e4e7ee] md:h-16" />
    </div>
  );
}

export function AccountList() {
  const { format } = useMoney();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<AccountPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountPublic | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/accounts", { credentials: "include" });
      const data = (await response.json()) as {
        accounts?: AccountPublic[];
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Unable to load accounts.");
        setAccounts([]);
        return;
      }

      setAccounts(data.accounts ?? []);
    } catch {
      setError("Network error. Please try again.");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (searchParams.get("created") === "1") {
      setBanner("Account created.");
    } else if (searchParams.get("updated") === "1") {
      setBanner("Account updated.");
    } else {
      setBanner(null);
    }
  }, [searchParams]);

  async function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/accounts/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = (await response.json()) as {
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        if (data.code === "ACCOUNT_NOT_EMPTY") {
          setDeleteError(
            "This account has transaction history and cannot be deleted. You can still rename it.",
          );
        } else {
          setDeleteError(data.error ?? "Unable to delete account.");
        }
        return;
      }

      setDeleteTarget(null);
      setBanner("Account deleted.");
      await loadAccounts();
      router.refresh();
    } catch {
      setDeleteError("Network error. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return <AccountListSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-800">{error}</p>
        <button
          type="button"
          onClick={() => void loadAccounts()}
          className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#1a1d29] shadow-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {banner ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {banner}
        </div>
      ) : null}

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e4e7ee] bg-white p-10 text-center">
          <p className="text-[#1a1d29] font-medium">No accounts yet.</p>
          <p className="mt-2 text-sm text-[#5a6072]">
            Add a bank, cash, or wallet to start your ledger.
          </p>
          <Link
            href="/accounts/new"
            className="mt-6 inline-flex rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae]"
          >
            Add account
          </Link>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-[#e4e7ee] bg-white md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#e4e7ee] bg-[#f4f6fb] text-[#5a6072]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Currency</th>
                  <th className="px-4 py-3 font-semibold">Balance</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-b border-[#e4e7ee] last:border-0">
                    <td className="px-4 py-3 font-medium text-[#1a1d29]">
                      <Link
                        href={`/accounts/${account.id}`}
                        className="text-[#2f5fdc] hover:underline"
                      >
                        {account.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#eef1f8] px-2.5 py-1 text-xs font-medium text-[#2f5fdc]">
                        {ACCOUNT_TYPE_LABELS[account.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#5a6072]">{account.currency}</td>
                    <td
                      className={`px-4 py-3 font-medium ${
                        account.cachedBalance < 0 ? "text-red-600" : "text-[#1a1d29]"
                      }`}
                    >
                      {format(account.cachedBalance)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/accounts/${account.id}/edit`}
                          className="text-sm font-medium text-[#2f5fdc] hover:underline"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(account);
                          }}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {accounts.map((account) => (
              <article
                key={account.id}
                className="rounded-xl border border-[#e4e7ee] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-[#1a1d29]">
                      <Link
                        href={`/accounts/${account.id}`}
                        className="text-[#2f5fdc] hover:underline"
                      >
                        {account.name}
                      </Link>
                    </h2>
                    <p className="mt-1 text-xs text-[#5a6072]">
                      {ACCOUNT_TYPE_LABELS[account.type]} · {account.currency}
                    </p>
                  </div>
                  <p
                    className={`text-lg font-bold ${
                      account.cachedBalance < 0 ? "text-red-600" : "text-[#1a1d29]"
                    }`}
                  >
                    {format(account.cachedBalance)}
                  </p>
                </div>
                <div className="mt-4 flex gap-3">
                  <Link
                    href={`/accounts/${account.id}/edit`}
                    className="text-sm font-medium text-[#2f5fdc]"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget(account);
                    }}
                    className="text-sm font-medium text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <DeleteAccountDialog
        accountName={deleteTarget?.name ?? ""}
        open={Boolean(deleteTarget)}
        loading={deleteLoading}
        error={deleteError}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => {
          if (!deleteLoading) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      />
    </>
  );
}
