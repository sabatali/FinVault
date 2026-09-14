"use client";

import { useMoney } from "@/components/currency/CurrencyProvider";
import { roundAmount } from "@/lib/money";
import { sharesRemaining, toPaisa } from "@/lib/splits";
import type { GroupMemberPublic } from "@/models/GroupMember";

interface ManualSplitInputsProps {
  members: GroupMemberPublic[];
  selectedIds: Set<string>;
  shareInputs: Record<string, string>;
  totalAmount: number;
  onShareChange: (memberId: string, value: string) => void;
  onToggleParticipant: (memberId: string) => void;
}

export function ManualSplitInputs({
  members,
  selectedIds,
  shareInputs,
  totalAmount,
  onShareChange,
  onToggleParticipant,
}: ManualSplitInputsProps) {
  const { format } = useMoney();
  const selectedAmounts = [...selectedIds].map((id) => {
    const raw = Number(shareInputs[id] ?? "");
    return Number.isFinite(raw) ? roundAmount(raw) : 0;
  });

  const remaining =
    Number.isFinite(totalAmount) && totalAmount > 0
      ? sharesRemaining(totalAmount, selectedAmounts)
      : null;
  const remainingOk = remaining !== null && toPaisa(remaining) === 0;

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {members.map((member) => {
          const checked = selectedIds.has(member.id);
          const inputId = `manual-share-${member.id}`;

          return (
            <li
              key={member.id}
              className="flex flex-col gap-2 rounded-lg border border-[#e4e7ee] px-3 py-2.5 sm:flex-row sm:items-center"
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleParticipant(member.id)}
                />
                <span className="text-sm text-[#1a1d29]">
                  {member.displayName}
                  {member.memberType === "guest" ? (
                    <span className="text-[#5a6072]"> · guest</span>
                  ) : null}
                </span>
              </label>
              {checked ? (
                <div className="sm:w-40">
                  <label htmlFor={inputId} className="sr-only">
                    Share for {member.displayName}
                  </label>
                  <input
                    id={inputId}
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={shareInputs[member.id] ?? ""}
                    onChange={(event) =>
                      onShareChange(member.id, event.target.value)
                    }
                    onBlur={(event) => {
                      const raw = Number(event.target.value);
                      if (Number.isFinite(raw) && raw > 0) {
                        onShareChange(member.id, String(roundAmount(raw)));
                      }
                    }}
                    className="w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
                    placeholder="0.00"
                    required
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {remaining !== null ? (
        <p
          role="status"
          aria-live="polite"
          className={`text-sm font-medium ${
            remainingOk ? "text-emerald-700" : "text-red-700"
          }`}
        >
          Remaining: {format(remaining)}
          {remainingOk
            ? " — shares match the total."
            : " — adjust shares until remaining is 0.00."}
        </p>
      ) : (
        <p className="text-sm text-[#5a6072]">
          Enter a total amount and select participants to allocate shares.
        </p>
      )}
    </div>
  );
}
