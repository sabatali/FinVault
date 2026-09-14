import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { claimGuestMembershipsForUser } from "@/lib/claim";
import { connectDB } from "@/lib/db";
import {
  claimMembersSchema,
  formatClaimZodErrors,
} from "@/lib/validators/claims";
import { withOptionalTransaction } from "@/lib/with-transaction";
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

  const parsed = claimMembersSchema.safeParse(body);
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

    const result = await withOptionalTransaction(async (session) => {
      return claimGuestMembershipsForUser(user, session, {
        memberIds: parsed.data.memberIds,
      });
    });

    if (result.claimed.length === 0) {
      return NextResponse.json(
        {
          error:
            "Could not claim those profiles. They may already be registered or use a different email.",
          claimedGroups: [],
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      claimedGroups: result.claimed,
    });
  } catch (error) {
    console.error("Claim guest memberships error:", error);
    return NextResponse.json(
      { error: "Could not claim; try again." },
      { status: 500 },
    );
  }
}
