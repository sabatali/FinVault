import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  Notification,
  toNotificationPublic,
} from "@/models/Notification";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  read: z.literal(true),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fields: { read: "Must be true" } },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const notification = await Notification.findOne({
      _id: id,
      user: auth.userId,
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 },
      );
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    return NextResponse.json({
      notification: toNotificationPublic(notification),
    });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return NextResponse.json(
      { error: "Unable to update notification" },
      { status: 500 },
    );
  }
}
