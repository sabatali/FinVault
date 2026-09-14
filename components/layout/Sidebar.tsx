"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { NAV_ITEMS } from "@/lib/navigation";

interface SidebarProps {
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ onNavigate, className = "" }: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className={`flex flex-col gap-1 ${className}`}
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-[#2f5fdc] text-white"
                : "text-[#1a1d29] hover:bg-[#f4f6fb]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm font-medium text-[#1a1d29]"
      >
        Menu
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu overlay"
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-nav-panel"
            ref={panelRef}
            className="fixed inset-y-0 left-0 z-50 w-72 border-r border-[#e4e7ee] bg-white p-4 shadow-lg"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-extrabold text-[#2f5fdc]">FinVault</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-[#5a6072] hover:bg-[#f4f6fb]"
              >
                Close
              </button>
            </div>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </>
      ) : null}
    </div>
  );
}
