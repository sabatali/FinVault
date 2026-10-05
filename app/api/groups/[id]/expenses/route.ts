import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { groupExpenseErrorResponse } from "@/lib/group-expense-errors";
import {
  buildGroupExpensePublic,
  createGroupExpense,
} from "@/lib/group-expense-service";
import {
  assertGroupMember,
  GroupAccessError,
  groupAccessErrorResponse,
} from "@/lib/group-access";
import {
  createGroupExpenseSchema,
  formatZodErrors,
} from "@/lib/validators/group-expense";
import { notifyGroupExpenseAdded } from "@/lib/notify";
import { GroupExpense } from "@/models/GroupExpense";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId } = await context.params;

  try {
    await assertGroupMember(auth.userId, groupId);
    await connectDB();

    const expenses = await GroupExpense.find({ group: groupId }).sort({
      occurredAt: -1,
      createdAt: -1,
    });

    const publicExpenses = await Promise.all(
      expenses.map((expense) => buildGroupExpensePublic(expense)),
    );

    return NextResponse.json({ expenses: publicExpenses });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    console.error("List group expenses error:", error);
    return NextResponse.json(
      { error: "Unable to fetch group expenses" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createGroupExpenseSchema.safeParse(body);
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
    const { group } = await assertGroupMember(auth.userId, groupId);
    const expense = await createGroupExpense({
      group,
      data: parsed.data,
      createdByUserId: auth.userId,
    });

    try {
      await notifyGroupExpenseAdded({
        group,
        expense,
        actorUserId: auth.userId,
      });
    } catch (error) {
      console.error("Group expense notification error:", error);
    }

    return NextResponse.json(
      { expense: await buildGroupExpensePublic(expense) },
      { status: 201 },
    );
  } catch (error) {
    const mapped = groupExpenseErrorResponse(error);
    if (mapped) {
      return mapped;
    }

    console.error("Create group expense error:", error);
    return NextResponse.json(
      { error: "Unable to create group expense" },
      { status: 500 },
    );
  }
}
