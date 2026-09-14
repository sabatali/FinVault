"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import type { PendingGuestClaim } from "@/lib/claim";

interface ClaimsPageClientProps {
  initialClaims: PendingGuestClaim[];
}

export function ClaimsPageClient({ initialClaims }: ClaimsPageClientProps) {
  const router = useRouter();
  const [claims, setClaims] = useState(initialClaims);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function claimOne(memberId: string) {
    setBusyId(memberId);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberIds: [memberId] }),
      });
      const data = (await response.json()) as {
        claimedGroups?: Array<{ groupName: string }>;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not claim; try again.");
        return;
      }
      const name = data.claimedGroups?.[0]?.groupName ?? "the group";
      setSuccess(`Claimed your profile in ${name}.`);
      setClaims((current) =>
        current.filter((claim) => claim.memberId !== memberId),
      );
      router.refresh();
    } catch {
      setError("Could not claim; try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function dismissOne(memberId: string) {
    setBusyId(memberId);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/claims/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberIds: [memberId] }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to dismiss.");
        return;
      }
      setClaims((current) =>
        current.map((claim) =>
          claim.memberId === memberId ? { ...claim, dismissed: true } : claim,
        ),
      );
    } catch {
      setError("Unable to dismiss.");
    } finally {
      setBusyId(null);
    }
  }

  const active = claims.filter((claim) => !claim.dismissed);
  const dismissed = claims.filter((claim) => claim.dismissed);

  return (
    <div className="space-y-6">
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
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {success}
        </div>
      ) : null}

      {claims.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#e4e7ee] bg-[#fafbfd] px-4 py-8 text-center text-sm text-[#5a6072]">
          No pending guest profiles match your email.
        </p>
      ) : null}

      {active.length > 0 ? (
        <section aria-labelledby="active-claims-heading">
          <h2
            id="active-claims-heading"
            className="text-base font-semibold text-[#1a1d29]"
          >
            Waiting for you
          </h2>
          <ul className="mt-3 divide-y divide-[#e4e7ee] overflow-hidden rounded-xl border border-[#e4e7ee] bg-white">
            {active.map((claim) => (
              <ClaimRow
                key={claim.memberId}
                claim={claim}
                busy={busyId === claim.memberId}
                onClaim={() => void claimOne(claim.memberId)}
                onDismiss={() => void dismissOne(claim.memberId)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {dismissed.length > 0 ? (
        <section aria-labelledby="dismissed-claims-heading">
          <h2
            id="dismissed-claims-heading"
            className="text-base font-semibold text-[#1a1d29]"
          >
            Skipped earlier (Not me)
          </h2>
          <p className="mt-1 text-sm text-[#5a6072]">
            These are still guest profiles with your email. You can claim them
            if you change your mind.
          </p>
          <ul className="mt-3 divide-y divide-[#e4e7ee] overflow-hidden rounded-xl border border-[#e4e7ee] bg-white">
            {dismissed.map((claim) => (
              <ClaimRow
                key={claim.memberId}
                claim={claim}
                busy={busyId === claim.memberId}
                onClaim={() => void claimOne(claim.memberId)}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ClaimRow({
  claim,
  busy,
  onClaim,
  onDismiss,
}: {
  claim: PendingGuestClaim;
  busy: boolean;
  onClaim: () => void;
  onDismiss?: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-[#1a1d29]">{claim.groupName}</p>
        <p className="text-sm text-[#5a6072]">
          Guest as {claim.displayName} · {claim.role}
          {claim.dismissed ? " · dismissed" : ""}
        </p>
        <Link
          href={`/groups/${claim.groupId}`}
          className="mt-1 inline-block text-xs font-medium text-[#2f5fdc] hover:underline"
        >
          Open group
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {onDismiss ? (
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm font-medium text-[#5a6072] hover:bg-[#f4f6fb] disabled:opacity-60"
          >
            Not me
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={onClaim}
          className="rounded-lg bg-[#2f5fdc] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1e3fae] disabled:opacity-60"
        >
          {busy ? "Working…" : "Claim"}
        </button>
      </div>
    </li>
  );
}
