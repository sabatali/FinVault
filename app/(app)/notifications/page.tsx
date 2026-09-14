import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NotificationsPageClient } from "@/components/notifications/NotificationsPageClient";
import { connectDB } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import {
  Notification,
  toNotificationPublic,
} from "@/models/Notification";

export const metadata: Metadata = {
  title: "Notifications — FinVault",
};

export default async function NotificationsPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    notFound();
  }

  await connectDB();
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ user: userId, readAt: null }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1a1d29]">
          Notifications
        </h1>
        <p className="mt-2 text-[#5a6072]">
          Group expenses and settlements that need your attention.
        </p>
      </div>
      <NotificationsPageClient
        key={`${unreadCount}-${notifications[0]?._id.toString() ?? "empty"}`}
        initialNotifications={notifications.map(toNotificationPublic)}
        initialUnreadCount={unreadCount}
      />
    </div>
  );
}
