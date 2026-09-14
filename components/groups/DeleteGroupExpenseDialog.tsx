"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import { useEffect, useRef } from "react";


interface DeleteGroupExpenseDialogProps {
  description: string;
  amount: number;
  currency: string;
  hasLedgerDebit: boolean;
  open: boolean;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteGroupExpenseDialog({
  description,
  amount,
  currency,
  hasLedgerDebit,
  open,
  loading,
  error,
  onConfirm,
  onCancel,
}: DeleteGroupExpenseDialogProps) {
  const { format } = useMoney();
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

  const amountText = format(amount);

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
        aria-labelledby="delete-group-expense-title"
        className="relative w-full max-w-md rounded-xl border border-[#e4e7ee] bg-white p-6 shadow-lg"
      >
        <h2
          id="delete-group-expense-title"
          className="text-lg font-bold text-[#1a1d29]"
        >
          {hasLedgerDebit
            ? `Delete expense and credit ${amountText}?`
            : "Delete group expense?"}
        </h2>
        <p className="mt-2 text-sm text-[#5a6072]">
          Remove <strong>{description}</strong>
          {hasLedgerDebit
            ? `. This will credit the payer’s account by ${amountText} (reverse the debit).`
            : " (guest payer — no ledger change)."}
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
            disabled={loading}
            onClick={onCancel}
            className="rounded-lg border border-[#e4e7ee] px-4 py-2.5 text-sm font-medium text-[#1a1d29] hover:bg-[#f5f6f9] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Deleting…" : "Delete expense"}
          </button>
        </div>
      </div>
    </div>
  );
}
