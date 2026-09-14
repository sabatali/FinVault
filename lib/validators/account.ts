import { z } from "zod";

import { ACCOUNT_CURRENCIES, ACCOUNT_TYPES } from "@/lib/account-types";
import { MONEY_MAX } from "@/lib/money";

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  type: z.enum(ACCOUNT_TYPES, {
    message: "Type must be bank, cash, or wallet",
  }),
  currency: z.enum(ACCOUNT_CURRENCIES).optional(),
  openingBalance: z
    .number({ message: "Opening balance must be a number" })
    .finite("Opening balance must be a finite number")
    .min(-MONEY_MAX, "Opening balance is too large (negative)")
    .max(MONEY_MAX, "Opening balance is too large")
    .optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80).optional(),
    type: z
      .enum(ACCOUNT_TYPES, {
        message: "Type must be bank, cash, or wallet",
      })
      .optional(),
    currency: z.enum(ACCOUNT_CURRENCIES).optional(),
  })
  .refine((data) => data.name || data.type || data.currency, {
    message: "At least one field is required",
  });

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

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
