import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ClaimSignupBanners } from "@/components/auth/ClaimSignupBanners";
import { GroupDetailHeader } from "@/components/groups/GroupDetailHeader";
import { GroupBalancesSkeleton } from "@/components/groups/GroupBalances";
import { GroupSettlementPanel } from "@/components/groups/GroupSettlementPanel";
import {
  GroupExpenseList,
  GroupExpenseListSkeleton,
} from "@/components/groups/GroupExpenseList";
import {
  LinkedAccounts,
  LinkedAccountsSkeleton,
} from "@/components/groups/LinkedAccounts";
import { MemberList, MemberListSkeleton } from "@/components/groups/MemberList";
import {
  GroupDetailTabs,
  type GroupTabId,
} from "@/components/groups/GroupDetailTabs";
import {
  TransferList,
  TransferListSkeleton,
} from "@/components/groups/TransferList";
import { connectDB } from "@/lib/db";
import { computeGroupBalances } from "@/lib/group-balances";
import { computePairwiseDebts } from "@/lib/group-pairwise";
import { loadGroupSettlementData } from "@/lib/load-group-settlement";
import { suggestionsFromBalances } from "@/lib/settlement-view";
import {
  assertGroupMember,
  GroupAccessError,
  listMembersForGroup,
} from "@/lib/group-access";
import { buildGroupTransferPublic } from "@/lib/group-transfer-public";
import { getSessionUserId } from "@/lib/session";
import { Account } from "@/models/Account";
import { toGroupPublic } from "@/models/Group";
import {
  GroupExpense,
  toGroupExpensePublic,
} from "@/models/GroupExpense";
import { GroupMember, toGroupMemberPublic } from "@/models/GroupMember";
import {
  GroupMemberAccount,
  toGroupMemberAccountPublic,
} from "@/models/GroupMemberAccount";
import { GroupTransfer } from "@/models/GroupTransfer";

export async function generateMetadata({
  params,
}: PageProps<"/groups/[id]">): Promise<Metadata> {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    return { title: "Group — FinVault" };
  }

  try {
    const { group } = await assertGroupMember(userId, id);
    return { title: `${group.name} — FinVault` };
  } catch {
    return { title: "Group — FinVault" };
  }
}

async function GroupMembersSection({
  groupId,
  groupName,
  isAdmin,
}: {
  groupId: string;
  groupName: string;
  isAdmin: boolean;
}) {
  const members = await listMembersForGroup(groupId);

  return (
    <section aria-labelledby="members-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="members-heading" className="text-lg font-semibold text-[#1a1d29]">
          Members
        </h2>
        <p className="text-sm text-[#5a6072]">
          {members.length} member{members.length === 1 ? "" : "s"}
        </p>
      </div>
      <MemberList
        groupId={groupId}
        groupName={groupName}
        initialMembers={members.map(toGroupMemberPublic)}
        isAdmin={isAdmin}
      />
    </section>
  );
}

async function LinkedAccountsSection({
  groupId,
  membershipId,
  userId,
}: {
  groupId: string;
  membershipId: string;
  userId: string;
}) {
  await connectDB();

  const links = await GroupMemberAccount.find({
    group: groupId,
    groupMember: membershipId,
  }).sort({ isPrimary: -1, createdAt: 1 });

  const accounts = await Account.find({
    _id: { $in: links.map((link) => link.account) },
    owner: userId,
  });
  const accountMap = new Map(
    accounts.map((account) => [account._id.toString(), account]),
  );

  const initialLinks = [];
  for (const link of links) {
    const account = accountMap.get(link.account.toString());
    if (account) {
      initialLinks.push(toGroupMemberAccountPublic(link, account));
    }
  }

  return (
    <section
      id="linked-accounts"
      className="scroll-mt-24"
      aria-labelledby="linked-accounts-heading"
    >      <div className="mb-3">
        <h2
          id="linked-accounts-heading"
          className="text-lg font-semibold text-[#1a1d29]"
        >
          Your accounts in this group
        </h2>
        <p className="mt-1 text-sm text-[#5a6072]">
          Linked accounts are used when you pay for shared expenses.
        </p>
      </div>
      <LinkedAccounts groupId={groupId} initialLinks={initialLinks} />
    </section>
  );
}

async function SettlementsSection({
  groupId,
  membershipId,
  userId,
}: {
  groupId: string;
  membershipId: string;
  userId: string;
}) {
  await connectDB();

  const [members, transfers, links] = await Promise.all([
    listMembersForGroup(groupId),
    GroupTransfer.find({ group: groupId }).sort({ createdAt: -1 }),
    GroupMemberAccount.find({
      group: groupId,
      groupMember: membershipId,
    }).sort({ isPrimary: -1, createdAt: 1 }),
  ]);

  const accounts = await Account.find({
    _id: { $in: links.map((link) => link.account) },
    owner: userId,
  });
  const accountMap = new Map(
    accounts.map((account) => [account._id.toString(), account]),
  );

  const ownLinks = [];
  for (const link of links) {
    const account = accountMap.get(link.account.toString());
    if (account) {
      ownLinks.push(toGroupMemberAccountPublic(link, account));
    }
  }

  const publicTransfers = await Promise.all(
    transfers.map((transfer) => buildGroupTransferPublic(transfer)),
  );

  return (
    <section aria-labelledby="settlements-heading">
      <div className="mb-3">
        <h2
          id="settlements-heading"
          className="text-lg font-semibold text-[#1a1d29]"
        >
          Settlements
        </h2>
        <p className="mt-1 text-sm text-[#5a6072]">
          Request a payment between registered members. Pending requests do not
          change balances until confirmed.
        </p>
      </div>
      <TransferList
        groupId={groupId}
        currentMemberId={membershipId}
        members={members.map(toGroupMemberPublic)}
        initialTransfers={publicTransfers}
        ownLinks={ownLinks}
      />
    </section>
  );
}

async function GroupBalancesSection({
  groupId,
  membershipId,
}: {
  groupId: string;
  membershipId: string;
}) {
  const [balances, members, settlement] = await Promise.all([
    computeGroupBalances(groupId),
    listMembersForGroup(groupId),
    loadGroupSettlementData(groupId),
  ]);
  const suggestions = suggestionsFromBalances(balances.members);
  const pairwise = computePairwiseDebts(settlement);

  return (
    <section aria-labelledby="balances-heading">
      <div className="mb-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="balances-heading"
              className="text-lg font-semibold text-[#1a1d29]"
            >
              Balances
            </h2>
            <p className="mt-1 text-sm text-[#5a6072]">
              Net position after shared expenses and confirmed settlements.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/groups/${groupId}/statement?member=${membershipId}`}
              className="rounded-lg border border-[#e4e7ee] bg-white px-4 py-2.5 text-sm font-semibold text-[#1a1d29] hover:bg-[#f4f6fb]"
            >
              View statement
            </Link>
            <Link
              href={`/groups/${groupId}/history`}
              className="rounded-lg border border-[#e4e7ee] bg-white px-4 py-2.5 text-sm font-semibold text-[#1a1d29] hover:bg-[#f4f6fb]"
            >
              View Full History
            </Link>
          </div>
        </div>
      </div>
      <GroupSettlementPanel
        groupId={groupId}
        currentMemberId={membershipId}
        balances={balances}
        members={members.map(toGroupMemberPublic)}
        suggestions={suggestions}
        pairwise={pairwise}
        pending={balances.pendingTransfers}
      />
    </section>
  );
}

async function GroupExpensesSection({ groupId }: { groupId: string }) {
  await connectDB();

  const expenses = await GroupExpense.find({ group: groupId }).sort({
    occurredAt: -1,
    createdAt: -1,
  });

  const memberIds = new Set<string>();
  for (const expense of expenses) {
    memberIds.add(expense.payerMember.toString());
    for (const participant of expense.participants) {
      memberIds.add(participant.member.toString());
    }
  }

  const members = await GroupMember.find({
    _id: { $in: [...memberIds] },
  });
  const nameMap = Object.fromEntries(
    members.map((member) => [member._id.toString(), member.displayName]),
  );

  const accountIds = expenses
    .map((expense) => expense.payerAccount?.toString())
    .filter((id): id is string => Boolean(id));
  const accounts = await Account.find({ _id: { $in: accountIds } }).select(
    "name",
  );
  const accountNames = new Map(
    accounts.map((account) => [account._id.toString(), account.name]),
  );

  const publicExpenses = expenses.map((expense) =>
    toGroupExpensePublic(expense, {
      payerDisplayName: nameMap[expense.payerMember.toString()],
      payerAccountName: expense.payerAccount
        ? accountNames.get(expense.payerAccount.toString())
        : undefined,
      participantNames: nameMap,
    }),
  );

  return (
    <section aria-labelledby="expenses-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="expenses-heading"
            className="text-lg font-semibold text-[#1a1d29]"
          >
            Shared expenses
          </h2>
          <p className="mt-1 text-sm text-[#5a6072]">
            Equal splits debit the payer’s real account for the full amount.
          </p>
        </div>
        <Link
          href={`/groups/${groupId}/expenses/new`}
          className="rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae]"
        >
          Add expense
        </Link>
      </div>
      <GroupExpenseList groupId={groupId} expenses={publicExpenses} />
    </section>
  );
}

export default async function GroupDetailPage({
  params,
  searchParams,
}: PageProps<"/groups/[id]">) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    notFound();
  }

  const query = await searchParams;

  let groupPublic;
  let membershipId: string;
  try {
    const { group, membership } = await assertGroupMember(userId, id);
    groupPublic = toGroupPublic(group, { role: membership.role });
    membershipId = membership._id.toString();
  } catch (error) {
    if (error instanceof GroupAccessError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const isAdmin = groupPublic.role === "admin";

  let defaultTab: GroupTabId = "balances";
  if (isGroupTabId(typeof query.tab === "string" ? query.tab : null)) {
    defaultTab = query.tab as GroupTabId;
  } else if (query.expenseCreated === "1" || query.expenseDeleted === "1") {
    defaultTab = "expenses";
  } else if (query.linkAccount === "1") {
    defaultTab = "accounts";
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ClaimSignupBanners
        claimed={query.claimed === "1"}
        inviteWarning={query.inviteWarning === "1"}
        linkAccountGroupName={
          query.linkAccount === "1" ? groupPublic.name : undefined
        }
        linkAccountGroupId={
          query.linkAccount === "1" ? groupPublic.id : undefined
        }
      />
      <GroupDetailHeader
        group={groupPublic}
        createdBanner={query.created === "1"}
        updatedBanner={query.updated === "1"}
        expenseCreatedBanner={query.expenseCreated === "1"}
        expenseDeletedBanner={query.expenseDeleted === "1"}
      />

      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-11 animate-pulse rounded-lg bg-[#e4e7ee]" />
            <GroupBalancesSkeleton />
          </div>
        }
      >
        <GroupDetailTabs
          groupId={id}
          defaultTab={defaultTab}
          panels={{
            balances: (
              <Suspense fallback={<GroupBalancesSkeleton />}>
                <GroupBalancesSection
                  groupId={id}
                  membershipId={membershipId}
                />
              </Suspense>
            ),
            settlements: (
              <Suspense fallback={<TransferListSkeleton />}>
                <SettlementsSection
                  groupId={id}
                  membershipId={membershipId}
                  userId={userId}
                />
              </Suspense>
            ),
            expenses: (
              <Suspense fallback={<GroupExpenseListSkeleton />}>
                <GroupExpensesSection groupId={id} />
              </Suspense>
            ),
            accounts: (
              <Suspense fallback={<LinkedAccountsSkeleton />}>
                <LinkedAccountsSection
                  groupId={id}
                  membershipId={membershipId}
                  userId={userId}
                />
              </Suspense>
            ),
            members: (
              <Suspense fallback={<MemberListSkeleton />}>
                <GroupMembersSection
                  groupId={id}
                  groupName={groupPublic.name}
                  isAdmin={isAdmin}
                />
              </Suspense>
            ),
          }}
        />
      </Suspense>
    </div>
  );
}

function isGroupTabId(value: string | null): value is GroupTabId {
  return (
    value === "balances" ||
    value === "settlements" ||
    value === "expenses" ||
    value === "accounts" ||
    value === "members"
  );
}
