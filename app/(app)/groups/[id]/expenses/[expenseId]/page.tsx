import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GroupExpenseDetail } from "@/components/groups/GroupExpenseDetail";
import { connectDB } from "@/lib/db";
import {
  assertGroupMember,
  GroupAccessError,
} from "@/lib/group-access";
import {
  buildGroupExpensePublic,
  canManageGroupExpense,
} from "@/lib/group-expense-service";
import { getSessionUserId } from "@/lib/session";
import { GroupExpense } from "@/models/GroupExpense";

export async function generateMetadata({
  params,
}: PageProps<"/groups/[id]/expenses/[expenseId]">): Promise<Metadata> {
  const { id, expenseId } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    return { title: "Group expense — FinVault" };
  }

  try {
    await assertGroupMember(userId, id);
    await connectDB();
    const expense = await GroupExpense.findOne({
      _id: expenseId,
      group: id,
    }).select("description");
    if (!expense) {
      return { title: "Group expense — FinVault" };
    }
    return { title: `${expense.description} — FinVault` };
  } catch {
    return { title: "Group expense — FinVault" };
  }
}

export default async function GroupExpenseDetailPage({
  params,
  searchParams,
}: PageProps<"/groups/[id]/expenses/[expenseId]">) {
  const { id: groupId, expenseId } = await params;
  const query = await searchParams;
  const userId = await getSessionUserId();
  if (!userId) {
    notFound();
  }

  let groupName: string;
  let membershipRole: "admin" | "member";
  try {
    const { group, membership } = await assertGroupMember(userId, groupId);
    groupName = group.name;
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

  const expense = await buildGroupExpensePublic(expenseDoc);
  const canManage = canManageGroupExpense({
    userId,
    membershipRole,
    expense: expenseDoc,
  });

  return (
    <GroupExpenseDetail
      groupId={groupId}
      groupName={groupName}
      expense={expense}
      canManage={canManage}
      updatedBanner={query.updated === "1"}
    />
  );
}
