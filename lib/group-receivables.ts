import { getGroupSummary } from "@/lib/dashboard";

export async function getGroupReceivablesForUser(userId: string): Promise<{
  totalOwedToYou: number;
  totalYouOwe: number;
  byGroup: Array<{ groupId: string; groupName: string; net: number }>;
}> {
  const summary = await getGroupSummary(userId);
  return {
    totalOwedToYou: summary.owedToYou,
    totalYouOwe: summary.youOwe,
    byGroup: summary.groups.map((group) => ({
      groupId: group.id,
      groupName: group.name,
      net: group.net,
    })),
  };
}
