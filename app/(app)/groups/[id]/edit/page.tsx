import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GroupForm } from "@/components/groups/GroupForm";
import { assertGroupAdmin, GroupAccessError } from "@/lib/group-access";
import { getSessionUserId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Rename group — FinVault",
};

export default async function EditGroupPage({
  params,
}: PageProps<"/groups/[id]/edit">) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    notFound();
  }

  let groupName = "";
  try {
    const { group } = await assertGroupAdmin(userId, id);
    groupName = group.name;
  } catch (error) {
    if (error instanceof GroupAccessError) {
      if (error.status === 404) {
        notFound();
      }
      // Non-admin member: show a clear message instead of a blank 403 page
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-800">
            Only admins can rename or delete this group.
          </p>
          <Link
            href={`/groups/${id}`}
            className="mt-4 inline-flex text-sm font-medium text-[#2f5fdc] hover:underline"
          >
            ← Back to group
          </Link>
        </div>
      );
    }
    throw error;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link
          href={`/groups/${id}`}
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to group
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1a1d29]">
          Rename group
        </h1>
        <p className="mt-2 text-[#5a6072]">Update the name for {groupName}.</p>
      </div>

      <GroupForm mode="edit" groupId={id} initialName={groupName} />
    </div>
  );
}
