"use client";

import type { GroupExpenseSplitType } from "@/models/GroupExpense";

interface SplitTypeToggleProps {
  value: GroupExpenseSplitType;
  onChange: (value: GroupExpenseSplitType) => void;
  disabled?: boolean;
}

export function SplitTypeToggle({
  value,
  onChange,
  disabled = false,
}: SplitTypeToggleProps) {
  return (
    <fieldset disabled={disabled} className="disabled:opacity-70">
      <legend className="text-sm font-semibold text-[#1a1d29]">Split type</legend>
      <div className="mt-2 flex gap-2" role="group" aria-label="Split type">
        <button
          type="button"
          aria-pressed={value === "equal"}
          onClick={() => onChange("equal")}
          className={
            value === "equal"
              ? "rounded-lg bg-[#2f5fdc] px-3 py-2 text-sm font-semibold text-white"
              : "rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm font-medium text-[#1a1d29] hover:bg-[#f5f6f9]"
          }
        >
          Equal
        </button>
        <button
          type="button"
          aria-pressed={value === "manual"}
          onClick={() => onChange("manual")}
          className={
            value === "manual"
              ? "rounded-lg bg-[#2f5fdc] px-3 py-2 text-sm font-semibold text-white"
              : "rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm font-medium text-[#1a1d29] hover:bg-[#f5f6f9]"
          }
        >
          Manual
        </button>
      </div>
    </fieldset>
  );
}
