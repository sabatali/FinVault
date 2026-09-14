"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DeleteGroupDialog } from "@/components/groups/DeleteGroupDialog";
import type { GroupPublic } from "@/models/Group";

interface GroupDetailHeaderProps {
  group: GroupPublic;
  createdBanner?: boolean;
  updatedBanner?: boolean;
  expenseCreatedBanner?: boolean;
  expenseDeletedBanner?: boolean;
}

export function GroupDetailHeader({
  group,
  createdBanner = false,
  updatedBanner = false,
  expenseCreatedBanner = false,
  expenseDeletedBanner = false,
}: GroupDetailHeaderProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isAdmin = group.role === "admin";

  async function handleDeleteConfirm() {
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/groups/${group.id}`, {
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

      router.push("/groups?deleted=1");
      router.refresh();
    } catch {
      setDeleteError("Network error. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <Link
          href="/groups"
          className="text-sm font-medium text-[#2f5fdc] hover:underline"
        >
          ← Back to groups
        </Link>

        {createdBanner ? (
          <div
            role="status"
            className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            Group created.
          </div>
        ) : null}
        {updatedBanner ? (
          <div
            role="status"
            className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            Group updated.
          </div>
        ) : null}
        {expenseCreatedBanner ? (
          <div
            role="status"
            className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            Group expense recorded.
          </div>
        ) : null}
        {expenseDeletedBanner ? (
          <div
            role="status"
            className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            Group expense deleted. Payer balance restored if a debit existed.
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1d29]">
              {group.name}
            </h1>
            <p className="mt-2 text-sm text-[#5a6072]">
              Your role: {isAdmin ? "Admin" : "Member"}
            </p>
          </div>

          {isAdmin ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/groups/${group.id}/edit`}
                className="inline-flex rounded-lg border border-[#e4e7ee] bg-white px-4 py-2.5 text-sm font-semibold text-[#1a1d29] hover:bg-[#f4f6fb]"
              >
                Rename
              </Link>
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
                className="inline-flex rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <DeleteGroupDialog
        groupName={group.name}
        open={deleteOpen}
        loading={deleteLoading}
        error={deleteError}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => {
          if (!deleteLoading) {
            setDeleteOpen(false);
            setDeleteError(null);
          }
        }}
      />
    </>
  );
}
