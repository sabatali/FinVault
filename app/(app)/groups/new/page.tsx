import type { Metadata } from "next";
import Link from "next/link";

import { GroupForm } from "@/components/groups/GroupForm";

export const metadata: Metadata = {
  title: "New group — FinVault",
};

export default function NewGroupPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link
          href="/groups"
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to groups
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1a1d29]">
          New group
        </h1>
        <p className="mt-2 text-[#5a6072]">
          You will be the admin. Members and expenses come next.
        </p>
      </div>

      <GroupForm mode="create" />
    </div>
  );
}
