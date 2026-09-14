"use client";

import { useEffect, useRef } from "react";

interface DeleteAccountDialogProps {
  accountName: string;
  open: boolean;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteAccountDialog({
  accountName,
  open,
  loading,
  error,
  onConfirm,
  onCancel,
}: DeleteAccountDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

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
        aria-labelledby="delete-account-title"
        className="relative w-full max-w-md rounded-xl border border-[#e4e7ee] bg-white p-6 shadow-lg"
      >
        <h2 id="delete-account-title" className="text-lg font-bold text-[#1a1d29]">
          Delete {accountName}?
        </h2>
        <p className="mt-2 text-sm text-[#5a6072]">
          This removes the account from FinVault. Accounts with transaction history
          cannot be deleted.
        </p>

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
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}
