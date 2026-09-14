import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GroupDetailHeader } from "@/components/groups/GroupDetailHeader";
import { GroupTabNav } from "@/components/groups/GroupDetailTabs";
import { GroupHistoryLog } from "@/components/groups/GroupHistoryLog";
import {
  assertGroupMember,
  GroupAccessError,
} from "@/lib/group-access";
import { loadGroupActivity } from "@/lib/load-group-activity";
import { getSessionUserId } from "@/lib/session";
import { toGroupPublic } from "@/models/Group";

export async function generateMetadata({
  params,
}: PageProps<"/groups/[id]/history">): Promise<Metadata> {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    return { title: "Group history — FinVault" };
  }

  try {
    const { group } = await assertGroupMember(userId, id);
    return { title: `Activity · ${group.name} — FinVault` };
  } catch {
    return { title: "Group history — FinVault" };
  }
}

export default async function GroupHistoryPage({
  params,
}: PageProps<"/groups/[id]/history">) {
  const { id } = await params;
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

  const { events, members } = await loadGroupActivity(id);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <GroupDetailHeader group={groupPublic} />
      <GroupTabNav groupId={id} active="history" />
      <div>
        <h2 className="text-lg font-semibold text-[#1a1d29]">Activity log</h2>
        <p className="mt-1 text-sm text-[#5a6072]">
          Every shared expense and settlement for {groupPublic.name}, in order
          — including pending and rejected transfers that are not in the final
          net.
        </p>
      </div>
      <GroupHistoryLog
        groupId={id}
        currentMemberId={currentMemberId}
        members={members}
        events={events}
      />
    </div>
  );
}
