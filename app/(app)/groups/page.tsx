import Link from "next/link";
import { notFound } from "next/navigation";

import { ClaimSignupBanners } from "@/components/auth/ClaimSignupBanners";
import { GroupList } from "@/components/groups/GroupList";
import { listGroupsForUser } from "@/lib/group-access";
import { getSessionUserId } from "@/lib/session";
import { toGroupPublic } from "@/models/Group";

export default async function GroupsPage({
  searchParams,
}: PageProps<"/groups">) {
  const userId = await getSessionUserId();
  if (!userId) {
    notFound();
  }

  const params = await searchParams;
  const created = params.created === "1";
  const updated = params.updated === "1";
  const deleted = params.deleted === "1";
  const claimed = params.claimed === "1";
  const inviteWarning = params.inviteWarning === "1";
  const claimedNames =
    typeof params.claimedNames === "string" ? params.claimedNames : undefined;

  const rows = await listGroupsForUser(userId);
  const groups = rows.map(({ group, role }) => toGroupPublic(group, { role }));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1d29]">
            Groups
          </h1>
          <p className="mt-2 text-[#5a6072]">
            Shared spaces for trips, roommates, and split expenses.
          </p>
        </div>
        <Link
          href="/groups/new"
          className="inline-flex items-center justify-center rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1e3fae]"
        >
          New group
        </Link>
      </div>

      <ClaimSignupBanners
        claimed={claimed}
        claimedNames={claimedNames}
        inviteWarning={inviteWarning}
      />

      {created ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          Group created.
        </div>
      ) : null}
      {updated ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          Group updated.
        </div>
      ) : null}
      {deleted ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          Group deleted.
        </div>
      ) : null}

      <GroupList
        key={groups.map((group) => group.id).join(",")}
        initialGroups={groups}
      />
    </div>
  );
}
