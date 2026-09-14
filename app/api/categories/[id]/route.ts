import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { countCategoryUsage } from "@/lib/category-access";
import { connectDB } from "@/lib/db";
import {
  formatZodErrors,
  updateCategorySchema,
} from "@/lib/validators/category";
import {
  Category,
  normalizeCategoryName,
  toCategoryPublic,
} from "@/models/Category";

type RouteContext = { params: Promise<{ id: string }> };

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}

async function findOwnedCustomCategory(userId: string, id: string) {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }

  await connectDB();
  return Category.findOne({
    _id: id,
    user: userId,
    isPredefined: false,
  });
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

  const parsed = updateCategorySchema.safeParse(body);
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
    const category = await findOwnedCustomCategory(auth.userId, id);
    if (!category) {
      // Hide whether a predefined id exists
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const name = parsed.data.name.trim();
    const nameNormalized = normalizeCategoryName(name);

    const conflictingPredefined = await Category.findOne({
      isPredefined: true,
      nameNormalized,
      kind: {
        $in:
          category.kind === "both"
            ? ["expense", "income", "both"]
            : [category.kind, "both"],
      },
    });

    if (conflictingPredefined) {
      return NextResponse.json(
        {
          error: "A predefined category with this name already exists.",
          fields: { name: "Name already exists" },
        },
        { status: 409 },
      );
    }

    category.name = name;
    category.nameNormalized = nameNormalized;
    await category.save();

    return NextResponse.json({ category: toCategoryPublic(category) });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        {
          error: "You already have a category with this name.",
          fields: { name: "Name already exists" },
        },
        { status: 409 },
      );
    }

    console.error("Update category error:", error);
    return NextResponse.json(
      { error: "Unable to update category" },
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
    const category = await findOwnedCustomCategory(auth.userId, id);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const usage = await countCategoryUsage(category._id);
    if (usage > 0) {
      return NextResponse.json(
        {
          error: `Category is in use by ${usage} entr${usage === 1 ? "y" : "ies"} and cannot be deleted.`,
          code: "CATEGORY_IN_USE",
          usage,
        },
        { status: 409 },
      );
    }

    await category.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete category error:", error);
    return NextResponse.json(
      { error: "Unable to delete category" },
      { status: 500 },
    );
  }
}
