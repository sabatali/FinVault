# Feature 3.1 — Group Model: Create, Rename, Delete

> **Project:** FinVault  
> **Phase:** 3 — Groups (Structure Only)  
> **Feature ID:** 3.1  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth

## Context for the Implementer

FinVault layers a **group expense/settlement system on top of** the personal ledger. This phase is **structure only**: named groups and membership. **No money movement, no GroupExpense, no linking accounts yet** (Phases 4–6).

A `Group` is a named container (e.g. "Goa Trip", "Flatmates"). Visibility rule from the project plan: *Group visible to creator and added members only.*

The creator becomes the first **admin** `GroupMember` (Feature 3.2). If you implement 3.1 and 3.2 together, create the Group + creator GroupMember in **one MongoDB session**. If 3.2 is strictly later, still create a member row for the creator here using the 3.2 schema so you do not migrate later — **preferred: implement creator membership in this feature using the GroupMember shape from 3.2**.

Guests are Feature 3.2+. Delete group: only if no expenses/transfers exist (none exist yet in Phase 3) — still define the rule: **admin-only delete**; if later phases have expenses, 409. For now, delete group + cascade **members only**.

---

## 1. Feature Overview

### Purpose

Introduce the `Group` model and let a registered user create, rename, list, and delete groups they belong to, with strict visibility.

### Business objective

Users need a place ("Goa Trip") before they can add members, link accounts, or split bills.

### User story

> As a registered user, I want to create a group, rename it, and delete it so I can organize shared finances with specific people. Only people in the group should see it.

---

## 2. Functional Requirements

### Complete feature behavior

1. Create group with `name`; set `createdBy` to current user; add creator as admin member.
2. List groups: only groups where the user has a `GroupMember` (registered, `user` = current user).
3. Get one: 404 if not a member (do not leak names of others' groups).
4. Rename: **admin only** (non-admin 403). Feature 3.3 restates this; enforce now.
5. Delete: **admin only**; cascade delete members (and later: block if expenses exist).
6. UI: replace `/groups` placeholder with list + create + detail header (members UI is 3.2–3.3).

### Validation rules

| Field | Rules |
|---|---|
| `name` | Required, trimmed, 1–80 chars. |

### User interactions

- `/groups` list, "New group", `/groups/[id]` with name and rename control for admins.
- Delete with typing the group name or a confirm dialog.

### Edge cases

- Empty name → 400.
- Non-member GET/PATCH/DELETE → 404 (prefer 404 over 403 for non-members to avoid id probing; **403 for members who are not admins**).
- Last admin deleting themselves is Feature 3.3; deleting the whole group is allowed for an admin here.

---

## 3. Technical Requirements

### Architecture considerations

`models/Group.ts`. Queries for list: find GroupMember by user, then groups. Index members by user.

### Database models/tables

**Collection: `groups`**

```ts
{
  name: string;
  createdBy: ObjectId; // User
  createdAt: Date;
  updatedAt: Date;
}
```

Creator membership: see Feature 3.2 `GroupMember`.

### APIs and services

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/groups` | Groups I belong to. |
| POST | `/api/groups` | Create + admin member. |
| GET | `/api/groups/[id]` | If member. |
| PATCH | `/api/groups/[id]` | Rename if admin. |
| DELETE | `/api/groups/[id]` | Delete if admin. |

### Background jobs or schedulers

None.

---

## 4. UI/UX Requirements

### Pages or components involved

- `app/(app)/groups/page.tsx`
- `app/(app)/groups/new/page.tsx`
- `app/(app)/groups/[id]/page.tsx` (header + empty "Members and expenses will appear here" until 3.2/5.x)
- `components/groups/GroupList.tsx`
- `components/groups/GroupForm.tsx`

### Loading, empty, success, and error states

- **Empty list:** "Create a group for roommates, a trip, or any shared expenses."
- **Loading:** skeletons.
- **Error:** 403 toast "Only admins can rename or delete this group."

### Responsive behavior

Card grid on desktop; stacked on mobile.

### Accessibility considerations

`h1` Groups; delete dialog labelled.

---

## 5. Implementation Guidelines

### Step-by-step

1. Group schema.
2. Create API with session: group + GroupMember admin (use 3.2 schema).
3. Membership helper `assertGroupMember(userId, groupId)` and `assertGroupAdmin`.
4. Build list/detail UI; enable Groups nav (already in 0.3).

### Recommended file structure

```text
models/Group.ts
models/GroupMember.ts      # if 3.2 schema created now
lib/group-access.ts
app/api/groups/route.ts
app/api/groups/[id]/route.ts
app/(app)/groups/...
```

### Best practices

- Centralize access checks; every group API uses them from here on.
- Do not list all groups in the database for debugging in production.

### Security considerations

- Visibility: creator **and** added members only.
- IDOR 404.

---

## 6. Dependencies

- 0.2–0.3 Auth + shell
- GroupMember schema (3.2) — implement the creator row now

### External libraries

- None new.

---

## 7. Acceptance Criteria

- [ ] Created group is visible to the creator.
- [ ] A second user who is not a member cannot see the group in GET list or GET by id (404).
- [ ] Creator can rename and delete.
- [ ] Delete removes the group (and its member rows).
- [ ] Unauthenticated access rejected.

**Out of scope:** guests, roles UI beyond creator-as-admin, invites, expenses, account linking.
