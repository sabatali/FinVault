# Feature 3.3 — Add / Remove Members & Roles (Admin / Member)

> **Project:** FinVault  
> **Phase:** 3 — Groups (Structure Only)  
> **Feature ID:** 3.3  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth

## Context for the Implementer

Project acceptance: *Non-admin is blocked from remove / rename actions.*

Roles:

- **admin** — rename group (3.1), add/remove members, change roles, delete group, later: no extra money powers unless you also require admin to record expenses — **do not** restrict group expense creation to admins in Phase 5 (any registered member can pay). Roles here are **structural**.
- **member** — can view the group, later add expenses/transfers; cannot rename, delete group, remove others, or promote/demote.

Adding:

- **Registered user:** admin enters an email that already has a FinVault `User`. Create `GroupMember` with `memberType: registered`, `role: member` by default.
- **Guest:** admin enters display name + email with **no** existing user **or** even if a user exists you may still add as registered if email matches a User — **rule: if email matches a User, add as registered; if not, add as guest.** This makes claim (7.1) cleaner.

Removing:

- Cannot remove the last admin.
- A member may **leave** the group themselves (optional); if you include leave, last admin cannot leave without deleting the group or promoting someone.
- Do not allow removing a member who will later have expenses — in Phase 3 nobody has expenses; **define for the future:** 409 `MEMBER_HAS_ACTIVITY` if the member is referenced by GroupExpense or GroupTransfer. Implement the check so Phase 5 does not forget.

Guest invite send is 3.4; this feature should call `queueGuestInvite(member)` if 3.4 exists, or leave a hook.

---

## 1. Feature Overview

### Purpose

Let group admins add/remove members and assign roles; block non-admins from those actions (and from rename, already in 3.1).

### Business objective

Only trusted people can change who is in the money-sharing group.

### User story

> As a group admin, I want to add people by email (as users or guests) and remove them.  
> As a non-admin member, I must not be able to remove people or rename the group.

---

## 2. Functional Requirements

### Complete feature behavior

1. POST add member (email, optional name, optional role).
2. DELETE member (by GroupMember id).
3. PATCH role (`admin` | `member`).
4. UI: add form on group page; role dropdown for admins; remove button; non-admins see list without those controls.
5. Rename already admin-only; verify non-admin PATCH name is 403.

### Validation rules

- Add: valid email; name required for guest path.
- Cannot add duplicate email in group (409).
- Cannot demote last admin.
- Cannot remove last admin.
- Non-admin: 403 `{ error: "Forbidden", code: "ADMIN_REQUIRED" }`.

### User interactions

- "Add member" — email, name (shown if guest), submit.
- Confirm remove: "Remove Ali from Goa Trip?"

### Edge cases

- Adding yourself: 409 already member.
- Adding existing user by email: registered member, name from User.
- Case-insensitive email match.
- Non-admin hitting API directly (not just hidden UI) must fail.

---

## 3. Technical Requirements

### APIs

| Method | Path | Who |
|---|---|---|
| POST | `/api/groups/[id]/members` | Admin |
| PATCH | `/api/groups/[id]/members/[memberId]` | Admin (role) |
| DELETE | `/api/groups/[id]/members/[memberId]` | Admin |

Body add:

```json
{ "email": "ali@example.com", "displayName": "Ali", "role": "member" }
```

### Models

Uses `GroupMember`. No new collection.

### Background jobs

Invite email: 3.4.

---

## 4. UI/UX Requirements

### Components

- `AddMemberForm.tsx`
- Role `<select>` on each row for admins
- Remove with dialog

### States

- **Loading add:** button disabled.
- **Success:** row appears.
- **Error:** duplicate, forbidden, validation.
- Non-admin: no add form, no remove.

### Responsive

Form stacked on mobile.

### Accessibility

Role select labeled per row (`aria-label="Role for Ali"`).

---

## 5. Implementation Guidelines

### Steps

1. `assertGroupAdmin` in `lib/group-access.ts`.
2. Add/remove/role handlers.
3. UI gated on `currentMember.role === "admin"`.
4. Tests: member token cannot DELETE.

### Security

- Enforce on server.
- 403 for in-group non-admin; 404 for non-members.

---

## 6. Dependencies

- 3.1 Group, 3.2 GroupMember
- 0.2 User lookup by email

---

## 7. Acceptance Criteria

- [ ] Admin can add a registered user by existing email and a guest by name+email.
- [ ] Admin can remove a member (subject to last-admin and future activity rules).
- [ ] Admin can change roles without leaving zero admins.
- [ ] Non-admin is blocked from remove / rename (and add/role) via API 403 and no UI controls.
- [ ] Duplicate email in the same group is rejected.

**Out of scope:** invite email body (3.4), expenses, claim.
