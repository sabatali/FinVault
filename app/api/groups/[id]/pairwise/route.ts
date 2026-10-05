import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import {
  assertGroupMember,
  GroupAccessError,
  groupAccessErrorResponse,
} from "@/lib/group-access";
import { computePairwiseDebts } from "@/lib/group-pairwise";
import { loadGroupSettlementData } from "@/lib/load-group-settlement";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId } = await context.params;

  try {
    await assertGroupMember(auth.userId, groupId);
    const data = await loadGroupSettlementData(groupId);
    const debts = computePairwiseDebts(data);

    return NextResponse.json({
      debts: debts.map((debt) => ({
        ...debt,
        debtorDisplayName:
          data.members.find((member) => member.memberId === debt.debtorMemberId)
            ?.displayName ?? "Member",
        creditorDisplayName:
          data.members.find((member) => member.memberId === debt.creditorMemberId)
            ?.displayName ?? "Member",
      })),
    });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    console.error("Get pairwise debts error:", error);
    return NextResponse.json(
      { error: "Unable to compute pairwise debts" },
      { status: 500 },
    );
  }
}
