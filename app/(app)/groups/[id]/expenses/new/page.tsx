import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GroupExpenseForm } from "@/components/groups/GroupExpenseForm";
import {
  assertGroupMember,
  GroupAccessError,
  listMembersForGroup,
} from "@/lib/group-access";
import { getSessionUserId } from "@/lib/session";
import { toGroupMemberPublic } from "@/models/GroupMember";

export async function generateMetadata({
  params,
}: PageProps<"/groups/[id]/expenses/new">): Promise<Metadata> {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    return { title: "Add group expense — FinVault" };
  }

  try {
    const { group } = await assertGroupMember(userId, id);
    return { title: `Add expense · ${group.name} — FinVault` };
  } catch {
    return { title: "Add group expense — FinVault" };
  }
}

export default async function NewGroupExpensePage({
  params,
}: PageProps<"/groups/[id]/expenses/new">) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    notFound();
  }

  let groupName: string;
  let currentMemberId: string;
  try {
    const { group, membership } = await assertGroupMember(userId, id);
    groupName = group.name;
    currentMemberId = membership._id.toString();
  } catch (error) {
    if (error instanceof GroupAccessError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const members = await listMembersForGroup(id);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href={`/groups/${id}`}
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to {groupName}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1a1d29]">
          Add group expense
        </h1>
        <p className="mt-2 text-[#5a6072]">
          Split equally among selected members. The payer’s account is debited
          the full amount.
        </p>
      </div>

      <div className="rounded-xl border border-[#e4e7ee] bg-white p-5 sm:p-6">
        <GroupExpenseForm
          groupId={id}
          groupName={groupName}
          members={members.map(toGroupMemberPublic)}
          currentMemberId={currentMemberId}
        />
      </div>
    </div>
  );
}
