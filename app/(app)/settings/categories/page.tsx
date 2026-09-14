import type { Metadata } from "next";
import Link from "next/link";

import { CategoryManager } from "@/components/categories/CategoryManager";
import { listCategoriesForUser } from "@/lib/category-access";
import { getSessionUserId } from "@/lib/session";
import { toCategoryPublic } from "@/models/Category";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Categories — FinVault",
};

export default async function CategoriesSettingsPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    notFound();
  }

  const categories = await listCategoriesForUser({ userId });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href="/expenses"
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to expenses
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1a1d29]">
          Categories
        </h1>
        <p className="mt-2 text-[#5a6072]">
          Tag expenses and income with predefined or custom categories.
        </p>
      </div>

      <CategoryManager initialCategories={categories.map(toCategoryPublic)} />
    </div>
  );
}
