import type { UserPublic } from "@/models/User";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/accounts", label: "Accounts" },
  { href: "/expenses", label: "Expenses" },
  { href: "/income", label: "Income" },
  { href: "/settings", label: "Settings" },
  { href: "/settings/categories", label: "Categories" },
  { href: "/groups", label: "Groups" },
  { href: "/claims", label: "Pending invites" },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

export interface AppShellUser {
  name: string;
  email: string;
}

export function toAppShellUser(user: UserPublic): AppShellUser {
  return {
    name: user.name,
    email: user.email,
  };
}
