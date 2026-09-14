import { z } from "zod";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Invalid id");

export const linkGroupAccountSchema = z.object({
  accountId: objectIdSchema,
});

export type LinkGroupAccountInput = z.infer<typeof linkGroupAccountSchema>;

export const setPrimaryAccountSchema = z
  .object({
    accountId: objectIdSchema.optional(),
    linkId: objectIdSchema.optional(),
  })
  .refine((data) => Boolean(data.accountId || data.linkId), {
    message: "accountId or linkId is required",
  });

export type SetPrimaryAccountInput = z.infer<typeof setPrimaryAccountSchema>;
