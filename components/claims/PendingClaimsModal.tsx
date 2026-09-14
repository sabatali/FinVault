"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { PendingGuestClaim } from "@/lib/claim";

const SESSION_SKIP_KEY = "finvault:pendingClaimsSkipped";

function readSessionSkipped(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return sessionStorage.getItem(SESSION_SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSessionSkipped() {
  try {
    sessionStorage.setItem(SESSION_SKIP_KEY, "1");
  } catch {
    // ignore
  }
}

export function PendingClaimsModal() {
  const router = useRouter();
  const pathname = usePathname();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [claims, setClaims] = useState<PendingGuestClaim[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [sessionSkipped, setSessionSkipped] = useState(() =>
    readSessionSkipped(),
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/claims/pending", {
          credentials: "include",
        });
        const data = (await response.json()) as {
          claims?: PendingGuestClaim[];
        };
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setClaims([]);
          setOpen(false);
          return;
        }
        const next = data.claims ?? [];
        setClaims(next);
        setSelected(new Set(next.map((claim) => claim.memberId)));
        setOpen(next.length > 0 && !readSessionSkipped());
      } catch {
        if (!cancelled) {
          setClaims([]);
          setOpen(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        writeSessionSkipped();
        setSessionSkipped(true);
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function toggleMember(memberId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }

  async function claimSelected() {
    const memberIds = [...selected];
    if (memberIds.length === 0) {
      setError("Select at least one profile to claim.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberIds }),
      });
      const data = (await response.json()) as {
        claimedGroups?: Array<{
          groupId: string;
          groupName: string;
          memberId: string;
        }>;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not claim; try again.");
        return;
      }

      const claimedIds = new Set(
        (data.claimedGroups ?? []).map((row) => row.memberId),
      );
      const stillPending = (claims ?? []).filter(
        (claim) => !claimedIds.has(claim.memberId),
      );
      setClaims(stillPending);
      setSelected(new Set(stillPending.map((claim) => claim.memberId)));
      if (stillPending.length === 0) {
        setOpen(false);
      }
      router.refresh();
    } catch {
      setError("Could not claim; try again.");
    } finally {
      setBusy(false);
    }
  }

  async function dismissSelected() {
    const memberIds = [...selected];
    if (memberIds.length === 0) {
      setError("Select at least one profile to dismiss.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/claims/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberIds }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to dismiss.");
        return;
      }
      const stillPending = (claims ?? []).filter(
        (claim) => !memberIds.includes(claim.memberId),
      );
      setClaims(stillPending);
      setSelected(new Set(stillPending.map((claim) => claim.memberId)));
      if (stillPending.length === 0) {
        setOpen(false);
      }
    } catch {
      setError("Unable to dismiss.");
    } finally {
      setBusy(false);
    }
  }

  function skipForNow() {
    writeSessionSkipped();
    setSessionSkipped(true);
    setOpen(false);
  }

  if (claims === null || !open || claims.length === 0 || sessionSkipped) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Skip for now"
        className="absolute inset-0 bg-black/30"
        onClick={skipForNow}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg rounded-xl border border-[#e4e7ee] bg-white p-6 shadow-lg"
      >
        <h2 id={titleId} className="text-lg font-bold text-[#1a1d29]">
          Guest profiles match your email
        </h2>
        <p className="mt-2 text-sm text-[#5a6072]">
          You were added as a guest in these groups. Claim a profile to keep
          your expense history, or choose Not me if it isn&apos;t you.
        </p>

        {error ? (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}

        <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {claims.map((claim) => {
            const checked = selected.has(claim.memberId);
            return (
              <li
                key={claim.memberId}
                className="rounded-lg border border-[#e4e7ee] px-3 py-2"
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={() => toggleMember(claim.memberId)}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-[#1a1d29]">
                      {claim.groupName}
                    </span>
                    <span className="block text-sm text-[#5a6072]">
                      Guest as {claim.displayName} · {claim.role}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            ref={closeRef}
            type="button"
            disabled={busy}
            onClick={skipForNow}
            className="rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm font-medium text-[#1a1d29] hover:bg-[#f4f6fb] disabled:opacity-60"
          >
            Skip for now
          </button>
          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => void dismissSelected()}
            className="rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm font-medium text-[#5a6072] hover:bg-[#f4f6fb] disabled:opacity-60"
          >
            Not me
          </button>
          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => void claimSelected()}
            className="rounded-lg bg-[#2f5fdc] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1e3fae] disabled:opacity-60"
          >
            {busy ? "Working…" : "Claim"}
          </button>
        </div>

        <p className="mt-3 text-xs text-[#5a6072]">
          Skipped for this session only. Dismissed profiles stay on{" "}
          <Link
            href="/claims"
            className="font-medium text-[#2f5fdc] hover:underline"
          >
            Pending group invites
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
