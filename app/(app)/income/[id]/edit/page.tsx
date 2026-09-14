import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import mongoose from "mongoose";

import { IncomeForm } from "@/components/income/IncomeForm";
import { connectDB } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { Income } from "@/models/Income";

export const metadata: Metadata = {
  title: "Edit income — FinVault",
};

export default async function EditIncomePage({
  params,
}: PageProps<"/income/[id]/edit">) {
  const { id } = await params;
  const userId = await getSessionUserId();

  if (!userId || !mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectDB();
  const income = await Income.findOne({ _id: id, user: userId });
  if (!income) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link
          href="/income"
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to income
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1a1d29]">
          Edit income
        </h1>
        <p className="mt-2 text-[#5a6072]">
          Update amount, account, date, or note. Ledger adjusts automatically.
        </p>
      </div>

      <IncomeForm
        mode="edit"
        incomeId={income._id.toString()}
        initialValues={{
          account: income.account.toString(),
          amount: income.amount,
          description: income.description,
          occurredAt: income.occurredAt.toISOString(),
          category: income.category ? income.category.toString() : null,
        }}
      />
    </div>
  );
}
