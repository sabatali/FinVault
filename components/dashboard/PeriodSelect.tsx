"use client";

import { useRouter } from "next/navigation";

import {
  DASHBOARD_PERIOD_LABELS,
  DASHBOARD_PERIODS,
  type DashboardPeriodKey,
} from "@/lib/period";

interface PeriodSelectProps {
  value: DashboardPeriodKey;
}

export function PeriodSelect({ value }: PeriodSelectProps) {
  const router = useRouter();

  return (
    <div>
      <label htmlFor="dashboard-period" className="block text-xs font-semibold text-[#5a6072]">
        Spending period
      </label>
      <select
        id="dashboard-period"
        value={value}
        onChange={(event) => {
          const next = event.target.value as DashboardPeriodKey;
          router.push(`/dashboard?period=${next}`);
        }}
        className="mt-1 w-full rounded-lg border border-[#e4e7ee] bg-white px-3 py-2 text-sm text-[#1a1d29] sm:w-auto"
      >
        {DASHBOARD_PERIODS.map((period) => (
          <option key={period} value={period}>
            {DASHBOARD_PERIOD_LABELS[period]}
          </option>
        ))}
      </select>
    </div>
  );
}
