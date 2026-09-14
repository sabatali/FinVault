import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { runLedgerAudit } from "@/lib/ledger-audit";

/**
 * Dev-only ledger audit. Disabled in production and when
 * ENABLE_ADMIN_AUDIT is not "true".
 */
export async function GET(_request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (process.env.ENABLE_ADMIN_AUDIT !== "true") {
    return NextResponse.json(
      { error: "Admin audit disabled. Set ENABLE_ADMIN_AUDIT=true in development." },
      { status: 403 },
    );
  }

  try {
    await connectDB();
    const report = await runLedgerAudit();
    return NextResponse.json(report, { status: report.ok ? 200 : 409 });
  } catch (error) {
    console.error("Admin audit error:", error);
    return NextResponse.json({ error: "Audit failed" }, { status: 500 });
  }
}
