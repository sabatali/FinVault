import Link from "next/link";
import { Suspense } from "react";

import { ExpenseList } from "@/components/expenses/ExpenseList";
import { listCategoriesForUser } from "@/lib/category-access";
import { connectDB } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { Account } from "@/models/Account";
import { Category } from "@/models/Category";
import { Expense, toExpensePublic } from "@/models/Expense";

function ExpenseListFallback() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-20 rounded-xl bg-[#e4e7ee]" />
      <div className="hidden h-12 rounded-lg bg-[#e4e7ee] md:block" />
      <div className="h-24 rounded-xl bg-[#e4e7ee] md:h-16" />
    </div>
  );
}

async function ExpensesContent({
  accountId,
  categoryId,
  from,
  to,
}: {
  accountId?: string;
  categoryId?: string;
  from?: string;
  to?: string;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    return null;
  }

  await connectDB();

  const filter: Record<string, unknown> = { user: userId };
  if (accountId) {
    filter.account = accountId;
  }
  if (categoryId) {
    filter.category = categoryId === "uncategorized" ? null : categoryId;
  }
  if (from || to) {
    const occurredAt: Record<string, Date> = {};
    if (from) {
      occurredAt.$gte = new Date(from);
    }
    if (to) {
      occurredAt.$lte = new Date(`${to}T23:59:59.999`);
    }
    filter.occurredAt = occurredAt;
  }

  const [expenses, accounts, categories] = await Promise.all([
    Expense.find(filter).sort({ occurredAt: -1 }).limit(50),
    Account.find({ owner: userId }).sort({ name: 1 }).select("name"),
    listCategoriesForUser({ userId, kind: "expense" }),
  ]);

  const categoryIds = [
    ...new Set(
      expenses
        .map((expense) => expense.category?.toString())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const usedCategories =
    categoryIds.length > 0
      ? await Category.find({ _id: { $in: categoryIds } }).select("name")
      : [];

  const accountNames = new Map(
    accounts.map((account) => [account._id.toString(), account.name]),
  );
  const categoryNames = new Map(
    usedCategories.map((category) => [category._id.toString(), category.name]),
  );

  return (
    <ExpenseList
      key={`${accountId ?? ""}-${categoryId ?? ""}-${from ?? ""}-${to ?? ""}`}
      initialExpenses={expenses.map((expense) =>
        toExpensePublic(expense, {
          accountName: accountNames.get(expense.account.toString()),
          categoryName: expense.category
            ? categoryNames.get(expense.category.toString())
            : "Uncategorized",
        }),
      )}
      accounts={accounts.map((account) => ({
        id: account._id.toString(),
        name: account.name,
      }))}
      categories={categories.map((category) => ({
        id: category._id.toString(),
        name: category.name,
      }))}
      initialFilters={{
        accountId: accountId ?? "",
        categoryId: categoryId ?? "",
        from: from ?? "",
        to: to ?? "",
      }}
    />
  );
}

export default async function ExpensesPage({
  searchParams,
}: PageProps<"/expenses">) {
  const params = await searchParams;
  const accountId =
    typeof params.accountId === "string" ? params.accountId : undefined;
  const categoryId =
    typeof params.categoryId === "string" ? params.categoryId : undefined;
  const from = typeof params.from === "string" ? params.from : undefined;
  const to = typeof params.to === "string" ? params.to : undefined;
  const created = params.created === "1";
  const updated = params.updated === "1";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1d29]">
            Expenses
          </h1>
          <p className="mt-2 text-[#5a6072]">
            Personal spending debited from your accounts.{" "}
            <Link
              href="/settings/categories"
              className="font-medium text-[#2f5fdc] hover:underline"
            >
              Manage categories
            </Link>
          </p>
        </div>
        <Link
          href="/expenses/new"
          className="inline-flex items-center justify-center rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1e3fae]"
        >
          Add expense
        </Link>
      </div>

      {created ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          Expense added.
        </div>
      ) : null}
      {updated ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          Expense updated.
        </div>
      ) : null}

      <Suspense fallback={<ExpenseListFallback />}>
        <ExpensesContent
          accountId={accountId}
          categoryId={categoryId}
          from={from}
          to={to}
        />
      </Suspense>
    </div>
  );
}
