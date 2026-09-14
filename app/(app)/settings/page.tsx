import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CurrencySettingsForm } from "@/components/settings/CurrencySettingsForm";
import { connectDB } from "@/lib/db";
import { getFxSnapshot, normalizeDisplayCurrency } from "@/lib/fx";
import { getSessionUserId } from "@/lib/session";
import { User } from "@/models/User";

export const metadata: Metadata = {
  title: "Settings — FinVault",
};

export default async function SettingsPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    notFound();
  }

  await connectDB();
  const user = await User.findById(userId);
  if (!user) {
    notFound();
  }

  const fx = getFxSnapshot();
  const preferredCurrency = normalizeDisplayCurrency(user.preferredCurrency);
  const rateNote =
    preferredCurrency === "PKR"
      ? `Spot rates: USD ${fx.rates.USD} PKR · EUR ${fx.rates.EUR} PKR (as of ${new Date(fx.asOf).toLocaleString()}).`
      : `Showing ${preferredCurrency} using ${fx.rates[preferredCurrency as "USD" | "EUR"] ?? "—"} PKR per 1 ${preferredCurrency}.`;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1d29]">
          Settings
        </h1>
        <p className="mt-2 text-[#5a6072]">
          Preferences for how FinVault displays your money.
        </p>
      </div>

      <CurrencySettingsForm
        initialCurrency={preferredCurrency}
        rateNote={rateNote}
      />

      <div className="rounded-xl border border-[#e4e7ee] bg-white p-5">
        <h2 className="text-base font-semibold text-[#1a1d29]">Categories</h2>
        <p className="mt-1 text-sm text-[#5a6072]">
          Manage expense and income categories.
        </p>
        <Link
          href="/settings/categories"
          className="mt-3 inline-flex text-sm font-semibold text-[#2f5fdc] hover:underline"
        >
          Open categories →
        </Link>
      </div>
    </div>
  );
}
