import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { listCategoriesForUser } from "@/lib/category-access";
import { connectDB } from "@/lib/db";
import { ensurePredefinedCategories } from "@/lib/seed-categories";
import {
  createCategorySchema,
  formatZodErrors,
} from "@/lib/validators/category";
import {
  Category,
  normalizeCategoryName,
  toCategoryPublic,
} from "@/models/Category";

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const kindParam = request.nextUrl.searchParams.get("kind");
  let kind: "expense" | "income" | undefined;
  if (kindParam === "expense" || kindParam === "income") {
    kind = kindParam;
  } else if (kindParam) {
    return NextResponse.json(
      { error: "Validation failed", fields: { kind: "kind must be expense or income" } },
      { status: 400 },
    );
  }

  try {
    const categories = await listCategoriesForUser({
      userId: auth.userId,
      kind,
    });

    return NextResponse.json({
      categories: categories.map(toCategoryPublic),
    });
  } catch (error) {
    console.error("List categories error:", error);
    return NextResponse.json(
      { error: "Unable to fetch categories" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: formatZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  const name = parsed.data.name.trim();
  const nameNormalized = normalizeCategoryName(name);
  const { kind } = parsed.data;
  const userId = new mongoose.Types.ObjectId(auth.userId);

  try {
    await ensurePredefinedCategories();
    await connectDB();

    const conflictingPredefined = await Category.findOne({
      isPredefined: true,
      nameNormalized,
      kind: { $in: kind === "both" ? ["expense", "income", "both"] : [kind, "both"] },
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

    const category = await Category.create({
      name,
      nameNormalized,
      kind,
      user: userId,
      isPredefined: false,
    });

    return NextResponse.json(
      { category: toCategoryPublic(category) },
      { status: 201 },
    );
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

    console.error("Create category error:", error);
    return NextResponse.json(
      { error: "Unable to create category" },
      { status: 500 },
    );
  }
}
