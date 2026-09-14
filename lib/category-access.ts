import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { ensurePredefinedCategories } from "@/lib/seed-categories";
import {
  Category,
  type CategoryKind,
  type ICategory,
} from "@/models/Category";
import { Expense } from "@/models/Expense";
import { Income } from "@/models/Income";

export class CategoryAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryAccessError";
  }
}

export async function resolveUsableCategory(input: {
  userId: string;
  categoryId: string | null | undefined;
  entryKind: "expense" | "income";
}): Promise<mongoose.Types.ObjectId | null> {
  if (input.categoryId === undefined || input.categoryId === null) {
    return null;
  }

  await ensurePredefinedCategories();
  await connectDB();

  if (!mongoose.isValidObjectId(input.categoryId)) {
    throw new CategoryAccessError("Invalid category");
  }

  const category = await Category.findById(input.categoryId);
  if (!category) {
    throw new CategoryAccessError("Category not found");
  }

  const allowedKind =
    category.kind === "both" || category.kind === input.entryKind;
  if (!allowedKind) {
    throw new CategoryAccessError(
      `Category is not valid for ${input.entryKind}`,
    );
  }

  if (category.isPredefined) {
    return category._id;
  }

  if (!category.user || category.user.toString() !== input.userId) {
    throw new CategoryAccessError("Category not found");
  }

  return category._id;
}

export async function listCategoriesForUser(input: {
  userId: string;
  kind?: "expense" | "income";
}): Promise<ICategory[]> {
  await ensurePredefinedCategories();
  await connectDB();

  const kindFilter =
    input.kind === undefined
      ? {}
      : { kind: { $in: [input.kind, "both"] as CategoryKind[] } };

  const categories = await Category.find({
    $and: [
      kindFilter,
      {
        $or: [{ isPredefined: true }, { user: input.userId, isPredefined: false }],
      },
    ],
  });

  return categories.sort((a, b) => {
    if (a.isPredefined !== b.isPredefined) {
      return a.isPredefined ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export async function countCategoryUsage(
  categoryId: mongoose.Types.ObjectId | string,
): Promise<number> {
  const [expenseCount, incomeCount] = await Promise.all([
    Expense.countDocuments({ category: categoryId }),
    Income.countDocuments({ category: categoryId }),
  ]);
  return expenseCount + incomeCount;
}
