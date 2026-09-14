import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { computeGroupBalances } from "@/lib/group-balances";
import {
  assertGroupMember,
  GroupAccessError,
  groupAccessErrorResponse,
} from "@/lib/group-access";
import { toPaisa } from "@/lib/splits";

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

    if (Math.abs(toPaisa(balances.sumOfNets)) > 1) {
      console.error(
        `[group-balances] sumOfNets drift for group ${groupId}:`,
        balances.sumOfNets,
      );
    }

    return NextResponse.json(balances);
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    console.error("Get group balances error:", error);
    return NextResponse.json(
      { error: "Unable to compute group balances" },
      { status: 500 },
    );
  }
}
