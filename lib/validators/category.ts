import { z } from "zod";

import { CATEGORY_KINDS } from "@/models/Category";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40, "Name is too long"),
  kind: z.enum(CATEGORY_KINDS, {
    message: "Kind must be expense, income, or both",
  }),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40, "Name is too long"),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

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
