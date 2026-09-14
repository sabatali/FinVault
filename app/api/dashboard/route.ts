import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { getCombinedDashboard } from "@/lib/dashboard";
import { isDashboardPeriodKey } from "@/lib/period";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const periodParam = request.nextUrl.searchParams.get("period") ?? "this_month";
  if (!isDashboardPeriodKey(periodParam)) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: {
          period: "period must be this_month, last_30, last_90, or all",
        },
      },
      { status: 400 },
    );
  }

  try {
    const dashboard = await getCombinedDashboard(auth.userId, periodParam);
    return NextResponse.json(dashboard);
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Unable to load dashboard" },
      { status: 500 },
    );
  }
}
