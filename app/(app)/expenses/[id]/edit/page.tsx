import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import mongoose from "mongoose";

import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { connectDB } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { Expense } from "@/models/Expense";

export const metadata: Metadata = {
  title: "Edit expense — FinVault",
};

export default async function EditExpensePage({
  params,
}: PageProps<"/expenses/[id]/edit">) {
  const { id } = await params;
  const userId = await getSessionUserId();

  if (!userId || !mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectDB();
  const expense = await Expense.findOne({ _id: id, user: userId });
  if (!expense) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link
          href="/expenses"
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to expenses
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1a1d29]">
          Edit expense
        </h1>
        <p className="mt-2 text-[#5a6072]">
          Update amount, account, date, or note. Ledger adjusts automatically.
        </p>
      </div>

      <ExpenseForm
        mode="edit"
        expenseId={expense._id.toString()}
        initialValues={{
          account: expense.account.toString(),
          amount: expense.amount,
          description: expense.description,
          occurredAt: expense.occurredAt.toISOString(),
          category: expense.category ? expense.category.toString() : null,
        }}
      />
    </div>
  );
}
