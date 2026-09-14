"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, type ReactNode } from "react";

export const GROUP_TABS = [
  { id: "balances", label: "Balances" },
  { id: "settlements", label: "Settlements" },
  { id: "expenses", label: "Shared expenses" },
  { id: "accounts", label: "Your accounts in this group" },
  { id: "members", label: "Members" },
] as const;

export type GroupTabId = (typeof GROUP_TABS)[number]["id"];
export type GroupSectionId = GroupTabId | "history";

function isGroupTabId(value: string | null): value is GroupTabId {
  return GROUP_TABS.some((tab) => tab.id === value);
}

function tabClassName(selected: boolean): string {
  return `shrink-0 border-b-2 px-3 py-3 text-sm font-semibold transition-colors sm:px-4 ${
    selected
      ? "border-[#2f5fdc] text-[#2f5fdc]"
      : "border-transparent text-[#5a6072] hover:text-[#1a1d29]"
  }`;
}

interface GroupTabNavProps {
  groupId: string;
  active: GroupSectionId;
  onSelectTab?: (tab: GroupTabId) => void;
}

export function GroupTabNav({ groupId, active, onSelectTab }: GroupTabNavProps) {
  return (
    <nav
      aria-label="Group sections"
      className="-mx-1 flex gap-0 overflow-x-auto border-b border-[#e4e7ee]"
    >
      {GROUP_TABS.map((tab) => {
        const selected = tab.id === active;
        if (onSelectTab) {
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              aria-current={selected ? "page" : undefined}
              className={tabClassName(selected)}
            >
              {tab.label}
            </button>
          );
        }
        return (
          <Link
            key={tab.id}
            href={`/groups/${groupId}?tab=${tab.id}`}
            aria-current={selected ? "page" : undefined}
            className={tabClassName(selected)}
          >
            {tab.label}
          </Link>
        );
      })}
      <Link
        href={`/groups/${groupId}/history`}
        aria-current={active === "history" ? "page" : undefined}
        className={tabClassName(active === "history")}
      >
        Activity log
      </Link>
    </nav>
  );
}

interface GroupDetailTabsProps {
  groupId: string;
  panels: Record<GroupTabId, ReactNode>;
  /** Preferred tab when `?tab=` is missing (e.g. after creating an expense). */
  defaultTab?: GroupTabId;
}

export function GroupDetailTabs({
  groupId,
  panels,
  defaultTab = "balances",
}: GroupDetailTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = useMemo<GroupTabId>(() => {
    const fromQuery = searchParams.get("tab");
    if (isGroupTabId(fromQuery)) {
      return fromQuery;
    }
    return defaultTab;
  }, [defaultTab, searchParams]);

  const setTab = useCallback(
    (tab: GroupTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      // Drop one-shot banners from the URL when switching tabs.
      params.delete("expenseCreated");
      params.delete("expenseDeleted");
      params.delete("created");
      params.delete("updated");
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="space-y-4">
      <GroupTabNav
        groupId={groupId}
        active={activeTab}
        onSelectTab={setTab}
      />

      {GROUP_TABS.map((tab) => {
        const selected = tab.id === activeTab;
        return (
          <div
            key={tab.id}
            id={`group-panel-${tab.id}`}
            role="tabpanel"
            aria-label={tab.label}
            hidden={!selected}
            className={selected ? "block" : "hidden"}
          >
            {panels[tab.id]}
          </div>
        );
      })}
    </div>
  );
}
