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

export const createGroupTransferSchema = z.object({
  toMemberId: objectIdSchema,
  /** Defaults to the current user's membership when omitted. */
  fromMemberId: objectIdSchema.optional(),
  amount: amountSchema,
  /** Required when the sender is registered. */
  fromAccountId: objectIdSchema.optional(),
  /** Optional when auto-confirming to a registered receiver (else primary). */
  toAccountId: objectIdSchema.optional(),
});

export type CreateGroupTransferInput = z.infer<typeof createGroupTransferSchema>;

export const confirmGroupTransferSchema = z.object({
  toAccountId: objectIdSchema.optional(),
});

export type ConfirmGroupTransferInput = z.infer<
  typeof confirmGroupTransferSchema
>;

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
