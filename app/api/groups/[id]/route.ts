import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import {
  assertGroupAdmin,
  assertGroupMember,
  deleteGroupAndMembers,
  GroupAccessError,
  groupAccessErrorResponse,
  groupHasFinancialHistory,
} from "@/lib/group-access";
import { withOptionalTransaction } from "@/lib/with-transaction";
import {
  formatZodErrors,
  updateGroupSchema,
} from "@/lib/validators/group";
import { toGroupPublic } from "@/models/Group";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  try {
    const { group, membership } = await assertGroupMember(auth.userId, id);
    return NextResponse.json({
      group: toGroupPublic(group, { role: membership.role }),
    });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }
    console.error("Get group error:", error);
    return NextResponse.json(
      { error: "Unable to fetch group" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: formatZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  try {
    const { group, membership } = await assertGroupAdmin(auth.userId, id);
    group.name = parsed.data.name.trim();
    await group.save();

    return NextResponse.json({
      group: toGroupPublic(group, { role: membership.role }),
    });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }
    console.error("Update group error:", error);
    return NextResponse.json(
      { error: "Unable to update group" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  try {
    const { group } = await assertGroupAdmin(auth.userId, id);

    if (await groupHasFinancialHistory(group._id)) {
      return NextResponse.json(
        {
          error: "This group has expenses or transfers and cannot be deleted.",
          code: "GROUP_NOT_EMPTY",
        },
        { status: 409 },
      );
    }

    await withOptionalTransaction(async (session) => {
      await deleteGroupAndMembers(group._id, session);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }
    console.error("Delete group error:", error);
    return NextResponse.json(
      { error: "Unable to delete group" },
      { status: 500 },
    );
  }
}
