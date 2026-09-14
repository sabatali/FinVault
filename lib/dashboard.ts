import { computeGroupBalances } from "@/lib/group-balances";
import {
  getPersonalDashboard,
  type PersonalDashboardData,
} from "@/lib/dashboard-personal";
import { connectDB } from "@/lib/db";
import { roundAmount } from "@/lib/money";
import { sumRounded, type DashboardPeriodKey } from "@/lib/period";
import { Group } from "@/models/Group";
import { GroupMember } from "@/models/GroupMember";

export type {
  DashboardAccountRow,
  SpendByCategoryRow,
} from "@/lib/dashboard-personal";

export interface GroupDashboardRow {
  id: string;
  name: string;
  net: number;
  memberId: string;
}

export interface GroupSummary {
  owedToYou: number;
  youOwe: number;
  groups: GroupDashboardRow[];
}

export interface CombinedDashboardData extends PersonalDashboardData {
  /** Σ account balances (ledger-backed). Same as accountsSum. */
  netWorth: number;
  /** Asserted equal to netWorth — sum of account.cachedBalance. */
  accountsSum: number;
  groupSummary: GroupSummary;
}

async function getGroupSummary(userId: string): Promise<GroupSummary> {
  await connectDB();

  const memberships = await GroupMember.find({
    user: userId,
    memberType: "registered",
  }).select("group");

  if (memberships.length === 0) {
    return { owedToYou: 0, youOwe: 0, groups: [] };
  }

  const groupIds = memberships.map((membership) => membership.group);
  const groups = await Group.find({ _id: { $in: groupIds } }).select("name");
  const groupNameById = new Map(
    groups.map((group) => [group._id.toString(), group.name]),
  );

  const balancesList = await Promise.all(
    memberships.map(async (membership) => {
      const groupId = membership.group.toString();
      const balances = await computeGroupBalances(groupId);
      const mine = balances.members.find(
        (member) => member.memberId === membership._id.toString(),
      );
      return {
        id: groupId,
        name: groupNameById.get(groupId) ?? "Group",
        net: roundAmount(mine?.net ?? 0),
        memberId: membership._id.toString(),
      };
    }),
  );

  balancesList.sort((a, b) => {
    if (Math.abs(b.net) !== Math.abs(a.net)) {
      return Math.abs(b.net) - Math.abs(a.net);
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  const owedToYou = sumRounded(
    balancesList.filter((row) => row.net > 0).map((row) => row.net),
  );
  const youOwe = sumRounded(
    balancesList.filter((row) => row.net < 0).map((row) => Math.abs(row.net)),
  );

  return {
    owedToYou,
    youOwe,
    groups: balancesList,
  };
}

export async function getCombinedDashboard(
  userId: string,
  periodKey: DashboardPeriodKey,
): Promise<CombinedDashboardData> {
  const [personal, groupSummary] = await Promise.all([
    getPersonalDashboard(userId, periodKey),
    getGroupSummary(userId),
  ]);

  const accountsSum = personal.totalBalance;
  const netWorth = accountsSum;

  return {
    ...personal,
    netWorth,
    accountsSum,
    groupSummary,
  };
}
