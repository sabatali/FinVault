import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { connectDB } from "@/lib/db";
import { findGuestInviteByToken } from "@/lib/invite";

export const metadata: Metadata = {
  title: "Group invite — FinVault",
};

export default async function InviteLandingPage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;

  await connectDB();
  const invite = await findGuestInviteByToken(token);

  if (!invite) {
    notFound();
  }

  if (invite.expired) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-bold text-[#1a1d29]">Invite expired</h2>
        <p className="mt-3 text-sm text-[#5a6072]">
          This invite for <strong>{invite.groupName}</strong> has expired. Ask a
          group admin to resend it.
        </p>
        <Link
          href="/signup"
          className="mt-6 inline-flex rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae]"
        >
          Go to signup
        </Link>
      </div>
    );
  }

  const signupHref = `/signup?email=${encodeURIComponent(invite.member.email)}&invite=${encodeURIComponent(token)}&group=${encodeURIComponent(invite.groupName)}`;

  return (
    <div className="text-center">
      <h2 className="text-xl font-bold text-[#1a1d29]">
        Join {invite.groupName}
      </h2>
      <p className="mt-3 text-sm text-[#5a6072]">
        You were invited as <strong>{invite.member.displayName}</strong> (
        {invite.member.email}). Create an account to continue.
      </p>
      <Link
        href={signupHref}
        className="mt-6 inline-flex rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae]"
      >
        Create account
      </Link>
    </div>
  );
}
