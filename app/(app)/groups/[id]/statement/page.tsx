import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GroupDetailHeader } from "@/components/groups/GroupDetailHeader";
import { GroupTabNav } from "@/components/groups/GroupDetailTabs";
import { MemberStatement } from "@/components/groups/MemberStatement";
import {
  assertGroupMember,
  GroupAccessError,
} from "@/lib/group-access";
import { buildMemberStatement } from "@/lib/group-statement";
import { loadGroupSettlementData } from "@/lib/load-group-settlement";
import { getSessionUserId } from "@/lib/session";
import { toGroupPublic } from "@/models/Group";

export async function generateMetadata({
  params,
}: PageProps<"/groups/[id]/statement">): Promise<Metadata> {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    return { title: "Statement — FinVault" };
  }

  try {
    const { group } = await assertGroupMember(userId, id);
    return { title: `Statement · ${group.name} — FinVault` };
  } catch {
    return { title: "Statement — FinVault" };
  }
}

export default async function GroupStatementPage({
  params,
  searchParams,
}: PageProps<"/groups/[id]/statement">) {
  const { id } = await params;
  const query = await searchParams;
  const userId = await getSessionUserId();
  if (!userId) {
    notFound();
  }

  let groupPublic;
  let currentMemberId: string;
  try {
    const { group, membership } = await assertGroupMember(userId, id);
    groupPublic = toGroupPublic(group, { role: membership.role });
    currentMemberId = membership._id.toString();
  } catch (error) {
    if (error instanceof GroupAccessError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const data = await loadGroupSettlementData(id);
  const requestedMember =
    typeof query.member === "string" ? query.member : currentMemberId;
  const member =
    data.members.find((row) => row.memberId === requestedMember) ??
    data.members.find((row) => row.memberId === currentMemberId);
  if (!member) {
    notFound();
  }

  const from =
    typeof query.from === "string" && query.from
      ? new Date(`${query.from}T00:00:00.000Z`).toISOString()
      : undefined;
  const to =
    typeof query.to === "string" && query.to
      ? new Date(`${query.to}T23:59:59.999Z`).toISOString()
      : undefined;

  const statement = buildMemberStatement({
    memberId: member.memberId,
    members: data.members,
    expenses: data.expenses,
    transfers: data.transfers,
    from,
    to,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <GroupDetailHeader group={groupPublic} />
      <GroupTabNav groupId={id} active="balances" />
      <div>
        <Link
          href={`/groups/${id}?tab=balances`}
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to balances
        </Link>
      </div>
      <MemberStatement
        groupId={id}
        memberName={member.displayName}
        members={data.members}
        selectedMemberId={member.memberId}
        statement={statement}
        from={typeof query.from === "string" ? query.from : ""}
        to={typeof query.to === "string" ? query.to : ""}
      />
    </div>
  );
}
