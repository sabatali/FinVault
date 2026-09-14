import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GroupExpenseForm } from "@/components/groups/GroupExpenseForm";
import { connectDB } from "@/lib/db";
import {
  assertGroupMember,
  GroupAccessError,
  listMembersForGroup,
} from "@/lib/group-access";
import {
  buildGroupExpensePublic,
  canManageGroupExpense,
} from "@/lib/group-expense-service";
import { getSessionUserId } from "@/lib/session";
import { GroupExpense } from "@/models/GroupExpense";
import { toGroupMemberPublic } from "@/models/GroupMember";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Edit group expense — FinVault" };
}

export default async function EditGroupExpensePage({
  params,
}: PageProps<"/groups/[id]/expenses/[expenseId]/edit">) {
  const { id: groupId, expenseId } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    notFound();
  }

  let groupName: string;
  let currentMemberId: string;
  let membershipRole: "admin" | "member";
  try {
    const { group, membership } = await assertGroupMember(userId, groupId);
    groupName = group.name;
    currentMemberId = membership._id.toString();
    membershipRole = membership.role;
  } catch (error) {
    if (error instanceof GroupAccessError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  await connectDB();
  const expenseDoc = await GroupExpense.findOne({
    _id: expenseId,
    group: groupId,
  });
  if (!expenseDoc) {
    notFound();
  }

  if (
    !canManageGroupExpense({
      userId,
      membershipRole,
      expense: expenseDoc,
    })
  ) {
    notFound();
  }

  const expense = await buildGroupExpensePublic(expenseDoc);
  const members = await listMembersForGroup(groupId);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href={`/groups/${groupId}/expenses/${expenseId}`}
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to expense
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1a1d29]">
          Edit group expense
        </h1>
        <p className="mt-2 text-[#5a6072]">
          Saving reverses the old ledger debit and posts a new one when the
          payer is registered.
        </p>
      </div>

      <div className="rounded-xl border border-[#e4e7ee] bg-white p-5 sm:p-6">
        <GroupExpenseForm
          mode="edit"
          expenseId={expenseId}
          initialExpense={expense}
          groupId={groupId}
          groupName={groupName}
          members={members.map(toGroupMemberPublic)}
          currentMemberId={currentMemberId}
        />
      </div>
    </div>
  );
}
