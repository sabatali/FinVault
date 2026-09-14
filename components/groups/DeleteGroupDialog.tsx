"use client";

import { useEffect, useRef, useState } from "react";

interface DeleteGroupDialogProps {
  groupName: string;
  open: boolean;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteGroupDialog({
  groupName,
  open,
  loading,
  error,
  onConfirm,
  onCancel,
}: DeleteGroupDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [confirmName, setConfirmName] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    cancelRef.current?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const canDelete = confirmName.trim() === groupName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/30"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-group-title"
        className="relative w-full max-w-md rounded-xl border border-[#e4e7ee] bg-white p-6 shadow-lg"
      >
        <h2 id="delete-group-title" className="text-lg font-bold text-[#1a1d29]">
          Delete group?
        </h2>
        <p className="mt-2 text-sm text-[#5a6072]">
          This permanently removes <strong>{groupName}</strong> and its members.
          Type the group name to confirm.
        </p>

        <label htmlFor="confirm-group-name" className="mt-4 block text-sm font-medium text-[#1a1d29]">
          Group name
        </label>
        <input
          key={groupName}
          id="confirm-group-name"
          type="text"
          defaultValue=""
          onChange={(event) => setConfirmName(event.target.value)}
          className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
          placeholder={groupName}
          autoComplete="off"
        />

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-[#e4e7ee] px-4 py-2 text-sm font-medium text-[#1a1d29] hover:bg-[#f4f6fb] disabled:opacity-70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || !canDelete}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Deleting…" : "Delete group"}
          </button>
        </div>
      </div>
    </div>
  );
}
