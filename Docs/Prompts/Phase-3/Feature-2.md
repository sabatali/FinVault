# Feature 3.2 — GroupMember Model (Registered Users + Guests)

> **Project:** FinVault  
> **Phase:** 3 — Groups (Structure Only)  
> **Feature ID:** 3.2  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth

## Context for the Implementer

**`GroupMember` is the canonical identity within a group.** All later expenses and transfers reference `GroupMember._id`, **not** `User` directly. This is essential for guests and for Feature 7.1 (claim preserves the same `_id`).

Two member types:

| Type | Shape |
|---|---|
| **Registered** | `user` ObjectId set; has login; will later link real `Account`s (Phase 4). |
| **Guest** | `user` null; no login; `displayName` + `email`; balances exist only as **bookkeeping** on group expenses — no real account to debit (until they claim). |

Invite email is Feature 3.4. Adding/removing and roles enforcement UI is Feature 3.3. This feature: **model + list both types correctly** on the group member list, and APIs to add a registered member (by email) and add a guest (name + email) **without** requiring the email send to be finished — 3.4 hooks into guest add.

**Claim:** do not implement claim here; store `email` normalized so 7.1 can match.

---

## 1. Feature Overview

### Purpose

Define `GroupMember` and display registered members and guests correctly on a group's member list.

### Business objective

Groups must include people who do not have FinVault yet (guests) without duplicating history when they later sign up.

### User story

> As a group admin, I want to see everyone in the group — people with FinVault accounts and guests I added by name/email — listed correctly.

---

## 2. Functional Requirements

### Complete feature behavior

1. Schema as below.
2. `GET /api/groups/[id]/members` returns all members with:
   - `id` (GroupMember `_id` — **this id is sacred**)
   - `memberType`: `registered` | `guest`
   - `displayName`
   - `email`
   - `role`: `admin` | `member`
   - `userId` (null for guests)
3. Creator already exists as admin from 3.1.
4. Adding members is fully specified in 3.3; this feature must at least **seed/list** correctly. If you implement add here, follow 3.3 validation.
5. UI: member list on `/groups/[id]` with badges Guest vs Registered.

### Validation rules (for documents)

- Registered: `user` required, `email` copied from User, `displayName` from User.name.
- Guest: `user` null, `displayName` required, `email` required valid email (normalized).
- Unique: one membership per `(group, user)` for registered; one per `(group, email)` for guests (so claim and invites stay unambiguous).

### User interactions

- Member list with avatar initials, name, email, role, type badge.

### Edge cases

- Same person cannot be both guest and registered in one group with the same email — unique email per group.
- Never show another group's members.
- Do not expose password hashes or other users' accounts here.

---

## 3. Technical Requirements

### Database models/tables

**Collection: `groupmembers` (or `group_members`)**

```ts
{
  group: ObjectId;
  user: ObjectId | null;
  memberType: "registered" | "guest";
  displayName: string;
  email: string;            // lowercase
  role: "admin" | "member";
  inviteTokenHash: string | null;  // 3.4
  inviteSentAt: Date | null;
  claimedAt: Date | null;   // 7.1
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes:

- `{ group: 1 }`
- unique `{ group: 1, user: 1 }` sparse
- unique `{ group: 1, email: 1 }`

### APIs

`GET /api/groups/[id]/members` — members only.

### Background jobs

None.

---

## 4. UI/UX Requirements

### Components

- `components/groups/MemberList.tsx`
- `components/groups/MemberBadge.tsx`

### States

- **Empty:** should not happen if creator is always a member; if it does, show error.
- **Loading:** skeleton rows.
- Guest rows visually distinct but not "lesser" — same row height, "Guest" badge.

### Responsive

Name + badge on first line; email secondary on mobile.

### Accessibility

List as `<ul>`; badges have text, not color only.

---

## 5. Implementation Guidelines

### Steps

1. Model + indexes.
2. Migrate creator insert from 3.1 to this schema if not already.
3. GET members with access check.
4. Render list.

### File structure

```text
models/GroupMember.ts
app/api/groups/[id]/members/route.ts
lib/group-access.ts
components/groups/MemberList.tsx
```

### Security

- Emails of group members are visible to other members (needed for settlements). Do not list emails of users outside the group.

---

## 6. Dependencies

- 3.1 Group + creator
- 0.2 User (email/name)

---

## 7. Acceptance Criteria

- [ ] Both member types are listed correctly in the group member list (registered vs guest once a guest exists; creator shows as registered).
- [ ] `GroupMember._id` is returned and stable.
- [ ] Unique constraints prevent duplicate user or email in the same group.
- [ ] Non-members cannot list members (404).

**Out of scope:** add/remove/role enforcement (3.3), invite email (3.4), claim (7.1), GroupMemberAccount (4.1).
