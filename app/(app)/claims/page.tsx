import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClaimsPageClient } from "@/components/claims/ClaimsPageClient";
import { listPendingGuestClaimsForUser } from "@/lib/claim";
import { connectDB } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { User } from "@/models/User";

export const metadata: Metadata = {
  title: "Pending group invites — FinVault",
};

export default async function ClaimsPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    notFound();
  }

  await connectDB();
  const user = await User.findById(userId);
  if (!user) {
    notFound();
  }

  const claims = await listPendingGuestClaimsForUser(user);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href="/groups"
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to groups
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1a1d29]">
          Pending group invites
        </h1>
        <p className="mt-2 text-[#5a6072]">
          Guest profiles that use your email. Claiming keeps the same member id
          and expense history.
        </p>
      </div>
      <ClaimsPageClient
        key={claims
          .map((claim) => `${claim.memberId}:${claim.dismissed ? "1" : "0"}`)
          .join("|")}
        initialClaims={claims}
      />
    </div>
  );
}
