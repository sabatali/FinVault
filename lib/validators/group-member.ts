import { z } from "zod";

import { GROUP_MEMBER_ROLES } from "@/models/GroupMember";

export const addGroupMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .transform((value) => value.toLowerCase()),
  displayName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name is too long")
    .optional(),
  role: z.enum(GROUP_MEMBER_ROLES).optional(),
});

export type AddGroupMemberInput = z.infer<typeof addGroupMemberSchema>;

export const updateGroupMemberRoleSchema = z.object({
  role: z.enum(GROUP_MEMBER_ROLES, {
    message: "Role must be admin or member",
  }),
});

export type UpdateGroupMemberRoleInput = z.infer<typeof updateGroupMemberRoleSchema>;
