import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models/Notification";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    await connectDB();
    const result = await Notification.updateMany(
      { user: auth.userId, readAt: null },
      { $set: { readAt: new Date() } },
    );

    return NextResponse.json({
      marked: result.modifiedCount,
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    return NextResponse.json(
      { error: "Unable to mark notifications read" },
      { status: 500 },
    );
  }
}
