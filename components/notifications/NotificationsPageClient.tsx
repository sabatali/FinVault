"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { NotificationPublic } from "@/models/Notification";

interface NotificationsPageClientProps {
  initialNotifications: NotificationPublic[];
  initialUnreadCount: number;
}

export function NotificationsPageClient({
  initialNotifications,
  initialUnreadCount,
}: NotificationsPageClientProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [busy, setBusy] = useState(false);

  async function markRead(notification: NotificationPublic) {
    if (!notification.readAt) {
      try {
        await fetch(`/api/notifications/${notification.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ read: true }),
        });
        setUnreadCount((count) => Math.max(0, count - 1));
        setItems((current) =>
          current.map((row) =>
            row.id === notification.id
              ? { ...row, readAt: new Date().toISOString() }
              : row,
          ),
        );
      } catch {
        // navigate anyway
      }
    }
    router.push(notification.href);
    router.refresh();
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
      setUnreadCount(0);
      setItems((current) =>
        current.map((row) => ({
          ...row,
          readAt: row.readAt ?? new Date().toISOString(),
        })),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#5a6072]">
          {unreadCount > 0
            ? `${unreadCount} unread`
            : "You're caught up."}
        </p>
        {unreadCount > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void markAllRead()}
            className="rounded-lg border border-[#e4e7ee] px-3 py-1.5 text-sm font-medium text-[#2f5fdc] hover:bg-[#eef3ff] disabled:opacity-60"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#e4e7ee] bg-[#fafbfd] px-4 py-10 text-center text-sm text-[#5a6072]">
          No notifications yet.
        </p>
      ) : (
        <ul className="divide-y divide-[#e4e7ee] overflow-hidden rounded-xl border border-[#e4e7ee] bg-white">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => void markRead(item)}
                className={`block w-full px-4 py-4 text-left hover:bg-[#f8f9fd] ${
                  item.readAt ? "" : "bg-[#f4f7fd]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1a1d29]">{item.title}</p>
                    <p className="mt-1 text-sm text-[#5a6072]">{item.body}</p>
                    <p className="mt-2 text-xs text-[#8b91a1]">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!item.readAt ? (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#2f5fdc]" />
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-[#5a6072]">
        Looking for group invites?{" "}
        <Link href="/claims" className="font-medium text-[#2f5fdc] hover:underline">
          Pending claims
        </Link>
      </p>
    </div>
  );
}
