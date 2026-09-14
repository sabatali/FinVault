import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { toUserPublic, User } from "@/models/User";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    await connectDB();

    const user = await User.findById(auth.userId);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ user: toUserPublic(user) });
  } catch (error) {
    console.error("Me error:", error);
    return NextResponse.json({ error: "Unable to fetch user" }, { status: 500 });
  }
}
