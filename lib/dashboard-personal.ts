import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { roundAmount } from "@/lib/money";
import {
  percentOfTotal,
  resolveDashboardPeriod,
  sumRounded,
  type DashboardPeriodKey,
} from "@/lib/period";
import { Account, type AccountType } from "@/models/Account";
import { Category } from "@/models/Category";
import { Expense } from "@/models/Expense";
import { Income } from "@/models/Income";

const TOP_CATEGORY_COUNT = 8;

export interface DashboardAccountRow {
  id: string;
  name: string;
  type: AccountType;
  cachedBalance: number;
}

export interface SpendByCategoryRow {
  categoryId: string | null;
  name: string;
  amount: number;
  percent: number;
}

export interface PersonalDashboardData {
  currency: string;
  totalBalance: number;
  accounts: DashboardAccountRow[];
  period: {
    key: DashboardPeriodKey;
    from: string | null;
    to: string;
    timezone: string;
  };
  incomeTotal: number;
  expenseTotal: number;
  spendByCategory: SpendByCategoryRow[];
}

function occurredAtFilter(from: Date | null, to: Date) {
  if (from) {
    return { $gte: from, $lte: to };
  }
  return { $lte: to };
}

export async function getPersonalDashboard(
  userId: string,
  periodKey: DashboardPeriodKey,
): Promise<PersonalDashboardData> {
  await connectDB();

  const period = resolveDashboardPeriod(periodKey);
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const dateFilter = occurredAtFilter(period.from, period.to);

  const [accounts, incomeAgg, expenseByCategory] = await Promise.all([
    Account.find({ owner: userId }).sort({ name: 1 }),
    Income.aggregate<{ total: number }>([
      {
        $match: {
          user: userObjectId,
          occurredAt: dateFilter,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Expense.aggregate<{ _id: mongoose.Types.ObjectId | null; amount: number }>([
      {
        $match: {
          user: userObjectId,
          occurredAt: dateFilter,
        },
      },
      {
        $group: {
          _id: "$category",
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { amount: -1 } },
    ]),
  ]);

  const accountRows: DashboardAccountRow[] = accounts.map((account) => ({
    id: account._id.toString(),
    name: account.name,
    type: account.type,
    cachedBalance: roundAmount(account.cachedBalance),
  }));

  const totalBalance = sumRounded(accountRows.map((row) => row.cachedBalance));
  const incomeTotal = roundAmount(incomeAgg[0]?.total ?? 0);
  const expenseTotal = sumRounded(expenseByCategory.map((row) => row.amount));

  const categoryIds = expenseByCategory
    .map((row) => row._id)
    .filter((id): id is mongoose.Types.ObjectId => id != null);

  const categories =
    categoryIds.length > 0
      ? await Category.find({ _id: { $in: categoryIds } }).select("name")
      : [];
  const categoryNames = new Map(
    categories.map((category) => [category._id.toString(), category.name]),
  );

  const mapped: SpendByCategoryRow[] = expenseByCategory.map((row) => {
    const amount = roundAmount(row.amount);
    const categoryId = row._id ? row._id.toString() : null;
    return {
      categoryId,
      name: categoryId
        ? (categoryNames.get(categoryId) ?? "Unknown")
        : "Uncategorized",
      amount,
      percent: percentOfTotal(amount, expenseTotal),
    };
  });

  let spendByCategory: SpendByCategoryRow[];
  if (mapped.length <= TOP_CATEGORY_COUNT) {
    spendByCategory = mapped;
  } else {
    const top = mapped.slice(0, TOP_CATEGORY_COUNT);
    const rest = mapped.slice(TOP_CATEGORY_COUNT);
    const otherAmount = sumRounded(rest.map((row) => row.amount));
    spendByCategory = [
      ...top,
      {
        categoryId: null,
        name: "Other",
        amount: otherAmount,
        percent: percentOfTotal(otherAmount, expenseTotal),
      },
    ];
  }

  return {
    currency: "PKR",
    totalBalance,
    accounts: accountRows,
    period: {
      key: period.key,
      from: period.from ? period.from.toISOString() : null,
      to: period.to.toISOString(),
      timezone: period.timezone,
    },
    incomeTotal,
    expenseTotal,
    spendByCategory,
  };
}
