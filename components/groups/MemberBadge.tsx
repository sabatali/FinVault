import type { GroupMemberRole, GroupMemberType } from "@/models/GroupMember";

interface MemberBadgeProps {
  memberType: GroupMemberType;
  role: GroupMemberRole;
}

export function MemberBadge({ memberType, role }: MemberBadgeProps) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          memberType === "guest"
            ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
            : "bg-[#eef1f8] text-[#2f5fdc]"
        }`}
      >
        {memberType === "guest" ? "Guest" : "Registered"}
      </span>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          role === "admin"
            ? "bg-[#1a1d29] text-white"
            : "bg-[#f4f6fb] text-[#5a6072]"
        }`}
      >
        {role === "admin" ? "Admin" : "Member"}
      </span>
    </span>
  );
}

export function memberInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
