import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { computeGroupBalances } from "@/lib/group-balances";
import {
  assertGroupMember,
  GroupAccessError,
  groupAccessErrorResponse,
} from "@/lib/group-access";
import { suggestTransfers } from "@/lib/settle";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId } = await context.params;

  try {
    await assertGroupMember(auth.userId, groupId);
    const balances = await computeGroupBalances(groupId);

    const suggestions = suggestTransfers(
      balances.members.map((member) => ({
        memberId: member.memberId,
        net: member.net,
      })),
    );

    const nameById = new Map(
      balances.members.map((member) => [member.memberId, member.displayName]),
    );

    return NextResponse.json({
      currency: balances.currency,
      suggestions: suggestions.map((row) => ({
        fromMemberId: row.fromMemberId,
        toMemberId: row.toMemberId,
        amount: row.amount,
        fromDisplayName: nameById.get(row.fromMemberId) ?? "Member",
        toDisplayName: nameById.get(row.toMemberId) ?? "Member",
      })),
    });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    console.error("Get settlement suggestions error:", error);
    return NextResponse.json(
      { error: "Unable to compute settlement suggestions" },
      { status: 500 },
    );
  }
}
