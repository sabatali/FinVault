import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { listPendingGuestClaimsForUser } from "@/lib/claim";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const includeDismissed =
    request.nextUrl.searchParams.get("includeDismissed") === "1";

  try {
    await connectDB();
    const user = await User.findById(auth.userId);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims = await listPendingGuestClaimsForUser(user);
    const visible = includeDismissed
      ? claims
      : claims.filter((claim) => !claim.dismissed);

    return NextResponse.json({
      claims: visible,
      pendingCount: claims.filter((claim) => !claim.dismissed).length,
    });
  } catch (error) {
    console.error("List pending claims error:", error);
    return NextResponse.json(
      { error: "Unable to load pending claims" },
      { status: 500 },
    );
  }
}
