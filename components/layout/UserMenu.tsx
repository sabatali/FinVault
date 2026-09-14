"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AppShellUser } from "@/lib/navigation";

interface UserMenuProps {
  user: AppShellUser;
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      try {
        sessionStorage.removeItem("finvault:pendingClaimsSkipped");
      } catch {
        // ignore
      }
    } catch {
      // Still redirect — cookie clear is best-effort from the client.
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  const displayName = user.name.trim() || user.email;

  return (
    <div className="flex items-center gap-3">
      <div className="hidden min-w-0 text-right sm:block">
        <p className="truncate text-sm font-medium text-[#1a1d29]">{displayName}</p>
        <p className="truncate text-xs text-[#5a6072]">{user.email}</p>
      </div>
      <Link
        href="/claims"
        className="hidden rounded-lg px-2 py-1.5 text-sm font-medium text-[#2f5fdc] hover:bg-[#eef3ff] sm:inline"
      >
        Invites
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="rounded-lg border border-[#e4e7ee] px-3 py-1.5 text-sm font-medium text-[#1a1d29] transition-colors hover:bg-[#f4f6fb] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Logging out…" : "Log out"}
      </button>
    </div>
  );
}
