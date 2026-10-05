import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { groupExpenseErrorResponse } from "@/lib/group-expense-errors";
import {
  assertCanManageGroupExpense,
  buildGroupExpensePublic,
  deleteGroupExpense,
  updateGroupExpense,
} from "@/lib/group-expense-service";
import {
  assertGroupMember,
  GroupAccessError,
  groupAccessErrorResponse,
} from "@/lib/group-access";
import {
  formatZodErrors,
  updateGroupExpenseSchema,
} from "@/lib/validators/group-expense";
import { GroupExpense } from "@/models/GroupExpense";

type RouteContext = { params: Promise<{ id: string; expenseId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId, expenseId } = await context.params;

  if (!mongoose.isValidObjectId(expenseId)) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  try {
    await assertGroupMember(auth.userId, groupId);
    await connectDB();

    const expense = await GroupExpense.findOne({
      _id: expenseId,
      group: groupId,
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({
      expense: await buildGroupExpensePublic(expense),
    });
  } catch (error) {
    if (error instanceof GroupAccessError) {
      return NextResponse.json(groupAccessErrorResponse(error), {
        status: error.status,
      });
    }

    console.error("Get group expense error:", error);
    return NextResponse.json(
      { error: "Unable to fetch group expense" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId, expenseId } = await context.params;

  if (!mongoose.isValidObjectId(expenseId)) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateGroupExpenseSchema.safeParse(body);
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
    const { group, membership } = await assertGroupMember(auth.userId, groupId);
    await connectDB();

    const expense = await GroupExpense.findOne({
      _id: expenseId,
      group: groupId,
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    assertCanManageGroupExpense({
      userId: auth.userId,
      membershipRole: membership.role,
      expense,
    });

    const updated = await updateGroupExpense({
      group,
      expense,
      data: parsed.data,
    });

    return NextResponse.json({
      expense: await buildGroupExpensePublic(updated),
    });
  } catch (error) {
    const mapped = groupExpenseErrorResponse(error);
    if (mapped) {
      return mapped;
    }

    console.error("Update group expense error:", error);
    return NextResponse.json(
      { error: "Unable to update group expense" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: groupId, expenseId } = await context.params;

  if (!mongoose.isValidObjectId(expenseId)) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  try {
    const { group, membership } = await assertGroupMember(auth.userId, groupId);
    await connectDB();

    const expense = await GroupExpense.findOne({
      _id: expenseId,
      group: groupId,
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    assertCanManageGroupExpense({
      userId: auth.userId,
      membershipRole: membership.role,
      expense,
    });

    await deleteGroupExpense({ group, expense });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = groupExpenseErrorResponse(error);
    if (mapped) {
      return mapped;
    }

    console.error("Delete group expense error:", error);
    return NextResponse.json(
      { error: "Unable to delete group expense" },
      { status: 500 },
    );
  }
}
