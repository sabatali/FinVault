"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DeleteGroupDialog } from "@/components/groups/DeleteGroupDialog";
import { formatDateTime } from "@/lib/format";
import type { GroupPublic } from "@/models/Group";

interface GroupListProps {
  initialGroups: GroupPublic[];
}

export function GroupList({ initialGroups }: GroupListProps) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);
  const [banner, setBanner] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupPublic | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/groups/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        if (response.status === 403) {
          setDeleteError("Only admins can rename or delete this group.");
        } else {
          setDeleteError(data.error ?? "Unable to delete group.");
        }
        return;
      }

      const deletedId = deleteTarget.id;
      setDeleteTarget(null);
      setBanner("Group deleted.");
      setGroups((current) => current.filter((group) => group.id !== deletedId));
      router.refresh();
    } catch {
      setDeleteError("Network error. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e4e7ee] bg-white p-6 text-center">
        <p className="font-medium text-[#1a1d29]">No groups yet.</p>
        <p className="mt-2 text-sm text-[#5a6072]">
          Create a group for roommates, a trip, or any shared expenses.
        </p>
        <Link
          href="/groups/new"
          className="mt-4 inline-flex rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae]"
        >
          New group
        </Link>
      </div>
    );
  }

  return (
    <>
      {banner ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {banner}
        </div>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {groups.map((group) => (
          <li key={group.id}>
            <article className="rounded-xl border border-[#e4e7ee] bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/groups/${group.id}`}
                    className="text-lg font-semibold text-[#2f5fdc] hover:underline"
                  >
                    {group.name}
                  </Link>
                  <p className="mt-1 text-xs text-[#5a6072]">
                    {group.role === "admin" ? "Admin" : "Member"} · Updated{" "}
                    {formatDateTime(group.updatedAt)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/groups/${group.id}`}
                  className="text-sm font-medium text-[#2f5fdc]"
                >
                  Open
                </Link>
                {group.role === "admin" ? (
                  <>
                    <Link
                      href={`/groups/${group.id}/edit`}
                      className="text-sm font-medium text-[#2f5fdc]"
                    >
                      Rename
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(group);
                      }}
                      className="text-sm font-medium text-red-600"
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          </li>
        ))}
      </ul>

      <DeleteGroupDialog
        groupName={deleteTarget?.name ?? ""}
        open={Boolean(deleteTarget)}
        loading={deleteLoading}
        error={deleteError}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => {
          if (!deleteLoading) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      />
    </>
  );
}
