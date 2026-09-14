/**
 * Period helpers for personal dashboard aggregations.
 *
 * Timezone: Asia/Karachi (UTC+5, no DST). Used for "this month" boundaries
 * and documented as the default for PKR users.
 */

import { roundAmount } from "@/lib/money";

export const DASHBOARD_TIMEZONE = "Asia/Karachi";
export const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

export const DASHBOARD_PERIODS = [
  "this_month",
  "last_30",
  "last_90",
  "all",
] as const;

export type DashboardPeriodKey = (typeof DASHBOARD_PERIODS)[number];

export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriodKey, string> = {
  this_month: "This month",
  last_30: "Last 30 days",
  last_90: "Last 3 months",
  all: "All time",
};

export function isDashboardPeriodKey(value: string): value is DashboardPeriodKey {
  return (DASHBOARD_PERIODS as readonly string[]).includes(value);
}

function karachiParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const shifted = new Date(date.getTime() + KARACHI_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

/** Convert a wall-clock Asia/Karachi datetime to a UTC Date. */
export function karachiLocalToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  return new Date(
    Date.UTC(year, monthIndex, day, hour, minute, second, ms) - KARACHI_OFFSET_MS,
  );
}

export interface PeriodRange {
  key: DashboardPeriodKey;
  from: Date | null;
  to: Date;
  timezone: typeof DASHBOARD_TIMEZONE;
}

export function resolveDashboardPeriod(
  key: DashboardPeriodKey,
  now = new Date(),
): PeriodRange {
  const to = now;

  if (key === "all") {
    return { key, from: null, to, timezone: DASHBOARD_TIMEZONE };
  }

  if (key === "last_30") {
    return {
      key,
      from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      to,
      timezone: DASHBOARD_TIMEZONE,
    };
  }

  if (key === "last_90") {
    return {
      key,
      from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      to,
      timezone: DASHBOARD_TIMEZONE,
    };
  }

  // this_month — start of calendar month in Asia/Karachi
  const { year, month } = karachiParts(now);
  const from = karachiLocalToUtc(year, month, 1, 0, 0, 0, 0);

  return { key, from, to, timezone: DASHBOARD_TIMEZONE };
}

export function roundPercent(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function percentOfTotal(amount: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return roundPercent((amount / total) * 100);
}

export function sumRounded(values: number[]): number {
  return roundAmount(values.reduce((sum, value) => sum + value, 0));
}
