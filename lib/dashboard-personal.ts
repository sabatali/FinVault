import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { roundAmount } from "@/lib/money";
import {
  percentOfTotal,
  resolveDashboardPeriod,
  sumRounded,
  type DashboardPeriodKey,
} from "@/lib/period";
import { fromPaisa, toPaisa } from "@/lib/splits";
import { Account, type AccountType } from "@/models/Account";
import { Category } from "@/models/Category";
import { Expense } from "@/models/Expense";
import { Group } from "@/models/Group";
import { GroupExpense } from "@/models/GroupExpense";
import { GroupMember } from "@/models/GroupMember";
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
  groupSpendByGroup?: Array<{
    groupId: string;
    groupName: string;
    amount: number;
  }>;
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

  const memberships = await GroupMember.find({
    user: userId,
    memberType: "registered",
  }).select("_id group");
  const memberIds = memberships.map((membership) => membership._id);

  const [accounts, incomeAgg, expenseByCategory, groupSpendAgg] =
    await Promise.all([
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
      Expense.aggregate<{ _id: mongoose.Types.ObjectId | null; amount: number }>(
        [
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
        ],
      ),
      memberIds.length > 0
        ? GroupExpense.aggregate<{
            _id: mongoose.Types.ObjectId;
            amount: number;
          }>([
            {
              $match: {
                "participants.member": { $in: memberIds },
                occurredAt: dateFilter,
              },
            },
            { $unwind: "$participants" },
            {
              $match: { "participants.member": { $in: memberIds } },
            },
            {
              $group: {
                _id: "$group",
                amount: { $sum: "$participants.shareAmount" },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

  const accountRows: DashboardAccountRow[] = accounts.map((account) => ({
    id: account._id.toString(),
    name: account.name,
    type: account.type,
    cachedBalance: roundAmount(account.cachedBalance),
  }));

  const groupIds = [
    ...new Set(groupSpendAgg.map((row) => row._id.toString())),
  ];
  const groups =
    groupIds.length > 0
      ? await Group.find({ _id: { $in: groupIds } }).select("name")
      : [];
  const groupNames = new Map(
    groups.map((group) => [group._id.toString(), group.name]),
  );

  const groupSpendByGroup = groupSpendAgg
    .map((row) => ({
      groupId: row._id.toString(),
      groupName: groupNames.get(row._id.toString()) ?? "Group",
      amount: roundAmount(row.amount),
    }))
    .sort((a, b) => b.amount - a.amount);

  const groupSpendTotal = fromPaisa(
    groupSpendByGroup.reduce((sum, row) => sum + toPaisa(row.amount), 0),
  );

  const totalBalance = sumRounded(accountRows.map((row) => row.cachedBalance));
  const incomeTotal = roundAmount(incomeAgg[0]?.total ?? 0);
  const personalExpenseTotal = sumRounded(
    expenseByCategory.map((row) => row.amount),
  );
  const expenseTotal = fromPaisa(
    toPaisa(personalExpenseTotal) + toPaisa(groupSpendTotal),
  );

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
      percent: 0,
    };
  });

  if (toPaisa(groupSpendTotal) > 0) {
    mapped.push({
      categoryId: null,
      name: "Group expenses",
      amount: groupSpendTotal,
      percent: 0,
    });
  }

  mapped.sort((a, b) => b.amount - a.amount);

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
        percent: 0,
      },
    ];
  }

  spendByCategory = spendByCategory.map((row) => ({
    ...row,
    percent: percentOfTotal(row.amount, expenseTotal),
  }));

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
    groupSpendByGroup,
  };
}
