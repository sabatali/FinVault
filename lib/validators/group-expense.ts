import { z } from "zod";

import { MONEY_MAX } from "@/lib/money";
import { GROUP_EXPENSE_SPLIT_TYPES } from "@/models/GroupExpense";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const amountSchema = z
  .number({ message: "Amount must be a number" })
  .finite("Amount must be a finite number")
  .gt(0, "Amount must be greater than zero")
  .max(MONEY_MAX, "Amount is too large")
  .refine((value) => {
    const scaled = Math.round(value * 100);
    return Math.abs(value * 100 - scaled) < 1e-8;
  }, "Amount must have at most 2 decimal places");

function parseOccurredAt(value: string): Date {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  return date;
}

function maxAllowedOccurredAt(): Date {
  const max = new Date();
  max.setHours(23, 59, 59, 999);
  max.setDate(max.getDate() + 1);
  return max;
}

const occurredAtSchema = z
  .string()
  .min(1, "Date is required")
  .transform((value, ctx) => {
    try {
      return parseOccurredAt(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Date must be a valid date" });
      return z.NEVER;
    }
  })
  .refine((date) => date.getTime() <= maxAllowedOccurredAt().getTime(), {
    message: "Date cannot be more than one day in the future",
  });

const shareSchema = z.object({
  memberId: objectIdSchema,
  amount: amountSchema,
});

export const createGroupExpenseSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(200, "Description is too long"),
    amount: amountSchema,
    occurredAt: occurredAtSchema,
    splitType: z.enum(GROUP_EXPENSE_SPLIT_TYPES).default("equal"),
    payerMemberId: objectIdSchema,
    payerAccountId: objectIdSchema.nullable().optional(),
    participantMemberIds: z
      .array(objectIdSchema)
      .min(1, "Select at least one participant")
      .superRefine((ids, ctx) => {
        if (new Set(ids).size !== ids.length) {
          ctx.addIssue({
            code: "custom",
            message: "Participants must be unique",
          });
        }
      }),
    shares: z.array(shareSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.splitType !== "manual") {
      return;
    }

    if (!data.shares || data.shares.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["shares"],
        message: "Manual split requires a share for each participant",
      });
      return;
    }

    const shareIds = data.shares.map((share) => share.memberId);
    if (new Set(shareIds).size !== shareIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["shares"],
        message: "Share member ids must be unique",
      });
    }

    const participantSet = new Set(data.participantMemberIds);
    const shareSet = new Set(shareIds);

    if (
      participantSet.size !== shareSet.size ||
      [...participantSet].some((id) => !shareSet.has(id))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["shares"],
        message: "Shares must match the selected participants",
      });
    }
  });

export type CreateGroupExpenseInput = z.infer<typeof createGroupExpenseSchema>;

/** PATCH body uses the same shape as create. */
export const updateGroupExpenseSchema = createGroupExpenseSchema;
export type UpdateGroupExpenseInput = CreateGroupExpenseInput;

export function formatZodErrors(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fields[key]) {
      fields[key] = issue.message;
    }
  }
  return fields;
}
