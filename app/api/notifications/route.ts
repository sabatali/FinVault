import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  Notification,
  toNotificationPublic,
} from "@/models/Notification";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const unreadOnly = request.nextUrl.searchParams.get("unread") === "1";
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(
    Math.max(Number.parseInt(limitParam ?? "20", 10) || 20, 1),
    50,
  );

  try {
    await connectDB();

    const filter: Record<string, unknown> = { user: auth.userId };
    if (unreadOnly) {
      filter.readAt = null;
    }

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(limit),
      Notification.countDocuments({ user: auth.userId, readAt: null }),
    ]);

    return NextResponse.json({
      notifications: notifications.map(toNotificationPublic),
      unreadCount,
    });
  } catch (error) {
    console.error("List notifications error:", error);
    return NextResponse.json(
      { error: "Unable to load notifications" },
      { status: 500 },
    );
  }
}
