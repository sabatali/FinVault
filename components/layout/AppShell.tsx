import Link from "next/link";

import { PendingClaimsModal } from "@/components/claims/PendingClaimsModal";
import { FxStatusBanner } from "@/components/currency/FxStatusBanner";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import type { AppShellUser } from "@/lib/navigation";

import { MobileNav, Sidebar } from "./Sidebar";
import { UserMenu } from "./UserMenu";

interface AppShellProps {
  user: AppShellUser;
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-[#f9fafc]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#e4e7ee] bg-white lg:flex">
        <div className="shrink-0 border-b border-[#e4e7ee] px-6 py-5">
          <Link href="/dashboard" className="text-xl font-extrabold text-[#2f5fdc]">
            FinVault
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <Sidebar />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-64">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>
        <div className="sticky top-0 z-20">
          <FxStatusBanner />
          <header className="flex items-center justify-between gap-4 border-b border-[#e4e7ee] bg-white px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <MobileNav />
              <Link
                href="/dashboard"
                className="text-lg font-extrabold text-[#2f5fdc] lg:hidden"
              >
                FinVault
              </Link>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <NotificationBell />
              <UserMenu user={user} />
            </div>
          </header>
        </div>

        <main id="main-content" className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>

      <PendingClaimsModal />
    </div>
  );
}

export function AppShellSkeleton() {
  return (
    <div className="min-h-dvh animate-pulse bg-[#f9fafc]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[#e4e7ee] bg-white lg:block">
        <div className="border-b border-[#e4e7ee] px-6 py-5">
          <div className="h-6 w-24 rounded bg-[#e4e7ee]" />
        </div>
        <div className="space-y-2 px-4 py-4">
          <div className="h-9 rounded-lg bg-[#e4e7ee]" />
          <div className="h-9 rounded-lg bg-[#e4e7ee]" />
          <div className="h-9 rounded-lg bg-[#e4e7ee]" />
        </div>
      </aside>
      <div className="flex min-h-dvh flex-col lg:pl-64">
        <div className="border-b border-[#e4e7ee] bg-white px-6 py-4">
          <div className="h-8 w-40 rounded bg-[#e4e7ee]" />
        </div>
        <div className="flex-1 p-6">
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="h-10 w-48 rounded bg-[#e4e7ee]" />
            <div className="h-24 rounded-xl bg-[#e4e7ee]" />
          </div>
        </div>
      </div>
    </div>
  );
}
