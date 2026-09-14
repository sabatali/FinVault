import { z } from "zod";

import { MONEY_MAX } from "@/lib/money";

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

export const createExpenseSchema = z.object({
  accountId: objectIdSchema,
  amount: amountSchema,
  occurredAt: occurredAtSchema,
  description: z.string().trim().max(200).optional(),
  categoryId: objectIdSchema.nullable().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z
  .object({
    accountId: objectIdSchema.optional(),
    amount: amountSchema.optional(),
    occurredAt: occurredAtSchema.optional(),
    description: z.string().trim().max(200).optional(),
    categoryId: objectIdSchema.nullable().optional(),
  })
  .refine(
    (data) =>
      data.accountId !== undefined ||
      data.amount !== undefined ||
      data.occurredAt !== undefined ||
      data.description !== undefined ||
      data.categoryId !== undefined,
    { message: "At least one field is required" },
  );

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

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
