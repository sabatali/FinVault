import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const claimMembersSchema = z.object({
  memberIds: z
    .array(objectIdSchema)
    .min(1, "Select at least one guest profile")
    .max(50),
});

export type ClaimMembersInput = z.infer<typeof claimMembersSchema>;

export const dismissClaimsSchema = claimMembersSchema;
export type DismissClaimsInput = z.infer<typeof dismissClaimsSchema>;

export function formatClaimZodErrors(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fields[key]) {
      fields[key] = issue.message;
    }
  }
  return fields;
}
