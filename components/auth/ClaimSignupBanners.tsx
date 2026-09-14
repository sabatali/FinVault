"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

interface ClaimSignupBannersProps {
  /** When true, prefer showing a claim success banner. */
  claimed?: boolean;
  /** Optional pipe-separated group names from the URL. */
  claimedNames?: string;
  /** When true, show invite warning (detail from sessionStorage when present). */
  inviteWarning?: boolean;
  /** Prompt to link an account for this group. */
  linkAccountGroupName?: string;
  linkAccountGroupId?: string;
}

function readAndClearInviteWarning(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const warning = sessionStorage.getItem("finvault:inviteWarning");
    sessionStorage.removeItem("finvault:inviteWarning");
    sessionStorage.removeItem("finvault:claimedGroups");
    return warning;
  } catch {
    return null;
  }
}

export function ClaimSignupBanners({
  claimed = false,
  claimedNames,
  inviteWarning = false,
  linkAccountGroupName,
  linkAccountGroupId,
}: ClaimSignupBannersProps) {
  const [storedWarning] = useState(() =>
    inviteWarning ? readAndClearInviteWarning() : null,
  );

  const claimMessage = useMemo(() => {
    if (!claimed) {
      return null;
    }

    const names =
      claimedNames
        ?.split("|")
        .map((value) => value.trim())
        .filter(Boolean) ?? [];

    if (names.length === 1) {
      return `We linked your guest profile in ${names[0]}.`;
    }
    if (names.length > 1) {
      return `We linked your guest profiles in ${names.join(", ")}.`;
    }
    if (linkAccountGroupName) {
      return `We linked your guest profile in ${linkAccountGroupName}.`;
    }
    return "We linked your guest profile.";
  }, [claimed, claimedNames, linkAccountGroupName]);

  const warningMessage = inviteWarning
    ? (storedWarning ??
      "Your invite could not be fully applied, but your account was created.")
    : null;

  if (!claimMessage && !warningMessage && !linkAccountGroupName) {
    return null;
  }

  return (
    <div className="mb-4 space-y-3">
      {claimMessage ? (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {claimMessage}
        </div>
      ) : null}
      {warningMessage ? (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          {warningMessage}
        </div>
      ) : null}
      {linkAccountGroupName && linkAccountGroupId ? (
        <div
          role="status"
          className="rounded-lg border border-[#d7e0f8] bg-[#f4f7fd] px-4 py-3 text-sm text-[#1a1d29]"
        >
          Link an account to {linkAccountGroupName} so you can pay from
          FinVault.{" "}
          <Link
            href={`#linked-accounts`}
            className="font-semibold text-[#2f5fdc] hover:underline"
          >
            Link an account
          </Link>
        </div>
      ) : null}
    </div>
  );
}
