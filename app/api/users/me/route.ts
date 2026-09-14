import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { DISPLAY_CURRENCIES } from "@/lib/fx";
import { toUserPublic, User } from "@/models/User";

const patchMeSchema = z.object({
  preferredCurrency: z.enum(DISPLAY_CURRENCIES),
});

export async function PATCH(request: NextRequest) {
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

  const parsed = patchMeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: {
          preferredCurrency: `Must be one of ${DISPLAY_CURRENCIES.join(", ")}`,
        },
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

    user.preferredCurrency = parsed.data.preferredCurrency;
    await user.save();

    return NextResponse.json({ user: toUserPublic(user) });
  } catch (error) {
    console.error("Patch user me error:", error);
    return NextResponse.json(
      { error: "Unable to update preferences" },
      { status: 500 },
    );
  }
}
