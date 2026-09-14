import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { dismissGuestClaimsForUser } from "@/lib/claim";
import { connectDB } from "@/lib/db";
import {
  dismissClaimsSchema,
  formatClaimZodErrors,
} from "@/lib/validators/claims";
import { User } from "@/models/User";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = dismissClaimsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: formatClaimZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const user = await User.findById(auth.userId);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await dismissGuestClaimsForUser(user, parsed.data.memberIds);

    return NextResponse.json({
      dismissedMemberIds: result.dismissedMemberIds,
    });
  } catch (error) {
    console.error("Dismiss guest claims error:", error);
    return NextResponse.json(
      { error: "Unable to dismiss claims" },
      { status: 500 },
    );
  }
}
