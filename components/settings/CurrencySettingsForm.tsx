"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { DISPLAY_CURRENCIES, type DisplayCurrency } from "@/lib/fx";

interface CurrencySettingsFormProps {
  initialCurrency: DisplayCurrency;
  rateNote?: string;
}

export function CurrencySettingsForm({
  initialCurrency,
  rateNote,
}: CurrencySettingsFormProps) {
  const router = useRouter();
  const [preferredCurrency, setPreferredCurrency] =
    useState<DisplayCurrency>(initialCurrency);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ preferredCurrency }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to save preferences.");
        return;
      }
      setSuccess("Display currency updated. Ledger amounts stay in PKR.");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[#e4e7ee] bg-white p-5 space-y-4"
    >
      <div>
        <h2 className="text-base font-semibold text-[#1a1d29]">
          Display currency
        </h2>
        <p className="mt-1 text-sm text-[#5a6072]">
          Amounts are always stored in PKR. This only changes how totals are
          shown. Enter new expenses and settlements in PKR.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          {success}
        </div>
      ) : null}

      <div>
        <label
          htmlFor="preferred-currency"
          className="block text-sm font-medium text-[#1a1d29]"
        >
          Preferred currency
        </label>
        <select
          id="preferred-currency"
          value={preferredCurrency}
          onChange={(event) =>
            setPreferredCurrency(event.target.value as DisplayCurrency)
          }
          className="mt-1 w-full max-w-xs rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
        >
          {DISPLAY_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>

      {rateNote ? (
        <p className="text-xs text-[#5a6072]">{rateNote}</p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae] disabled:opacity-70"
      >
        {loading ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
