"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { NotificationPublic } from "@/models/Notification";

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const deltaSec = Math.round((Date.now() - then) / 1000);
  if (deltaSec < 60) return "just now";
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h ago`;
  return `${Math.floor(deltaSec / 86400)}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationPublic[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/notifications?limit=8", {
          credentials: "include",
        });
        const data = (await response.json()) as {
          notifications?: NotificationPublic[];
          unreadCount?: number;
        };
        if (cancelled || !response.ok) {
          if (!cancelled && !response.ok) {
            setItems([]);
          }
          return;
        }
        setItems(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function markReadAndGo(notification: NotificationPublic) {
    setOpen(false);
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
          (current ?? []).map((row) =>
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
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
      setUnreadCount(0);
      setItems((current) =>
        (current ?? []).map((row) => ({
          ...row,
          readAt: row.readAt ?? new Date().toISOString(),
        })),
      );
    } catch {
      // ignore
    }
  }

  const badge =
    unreadCount <= 0 ? null : unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg border border-[#e4e7ee] px-2.5 py-1.5 text-sm font-medium text-[#1a1d29] hover:bg-[#f4f6fb]"
      >
        Alerts
        {badge ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label="Recent notifications"
          className="absolute right-0 z-40 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-[#e4e7ee] bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-[#e4e7ee] px-3 py-2">
            <p className="text-sm font-semibold text-[#1a1d29]">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-[#2f5fdc] hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {items === null ? (
            <p className="px-3 py-6 text-center text-sm text-[#5a6072]">
              Loading…
            </p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[#5a6072]">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-[#e4e7ee] overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void markReadAndGo(item)}
                    className={`block w-full px-3 py-3 text-left hover:bg-[#f8f9fd] ${
                      item.readAt ? "" : "bg-[#f4f7fd]"
                    }`}
                  >
                    <p className="text-sm font-semibold text-[#1a1d29]">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[#5a6072]">{item.body}</p>
                    <p className="mt-1 text-[11px] text-[#8b91a1]">
                      {formatRelative(item.createdAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-[#e4e7ee] px-3 py-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-[#2f5fdc] hover:underline"
            >
              See all
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
