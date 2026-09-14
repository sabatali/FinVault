# Feature 7.1 — Guest Claims Profile via Matching Email on Signup

> **Project:** FinVault  
> **Phase:** 7 — Guest Claim Flow  
> **Feature ID:** 7.1  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · JWT auth

## Context for the Implementer

A guest can later **claim** their profile by signing up with a **matching email**. This converts the guest into a registered user while **preserving the same `GroupMember._id`**, so history is never duplicated or lost.

Acceptance: *`GroupMember._id` preserved — no duplicate history created.*

All `GroupExpense.payerMember`, `participants.member`, and `GroupTransfer.fromMember/toMember` already point at that `_id`. After claim they still do. **Do not** create a second GroupMember.

On signup (Feature 0.2): after creating `User`, find `GroupMember` where `memberType: "guest"` and `email === user.email` (normalized). For each (can be multiple groups):

```
user: newUser._id
memberType: "registered"
displayName: keep or update to User.name
claimedAt: now
inviteTokenHash: null
```

**Do not change `_id`.**

Invite token path: if signup includes `invite` token, claim **that** member if email matches, even if you also claim others with same email.

If a GroupMember already exists as registered with this user in that group, skip (unique user per group). If guest email matches but that group already has this user as registered (shouldn't), abort that group with log.

After claim, the user still must **link accounts** (Phase 4) — do not auto-link. UI prompt: "Link an account to {group} so you can pay from FinVault."

Passwords: guest had none; the new User is a normal registered account.

---

## 1. Feature Overview

### Purpose

Convert guest GroupMembers into registered members on signup without duplicating member ids or expense history.

### Business objective

People added before they had FinVault keep a continuous "who owes whom" record once they join.

### User story

> I was added as a guest to Goa Trip. I sign up with the same email and see that same membership — old dinners still list me, not a clone.

---

## 2. Functional Requirements

### Complete feature behavior

1. Hook into `POST /api/auth/signup` **in the same session** as User create: claim all matching guests.
2. Return `{ user, claimedGroups: [{ groupId, groupName, memberId }] }`.
3. Idempotent: signing up twice is impossible (unique email). Logging in does not re-claim (7.2 handles existing users who were guests in other groups — wait, if they already signed up, guests with that email should have been claimed. 7.2 covers **invite after** they had an account, or missed claim. This feature is **signup**.)
4. If invite token present: verify hash, email match, not expired; claim that member first.

### Validation

- Email match is exact on normalized email.
- Token mismatch: still allow signup; do not claim that member; show warning.

### User interactions

- After signup, toast "We linked your guest profile in Goa Trip."
- Redirect to group or dashboard.

### Edge cases

- Multiple groups, same guest email: claim **all**.
- Email already a registered member in a group **and** a leftover guest (data bug): skip guest, do not duplicate; optionally merge by deleting the guest row **only if** it has **no** expense references — if it has references, **keep guest id** and do not attach user (manual ops). Prefer unique email index so this cannot happen.
- Case differences in email: already normalized.

---

## 3. Technical Requirements

### Models

GroupMember fields from 3.2: `user`, `memberType`, `claimedAt`.

### APIs

Signup response extended. No separate claim API required for the signup path (7.2 adds explicit claim).

`claimGuestMembershipsForUser(user, session, { inviteToken? })` in `lib/claim.ts`.

### Background jobs

None.

---

## 4. UI/UX Requirements

- Signup success message listing claimed group names.
- If none, no extra UI.

### States

- Partial token failure: signup succeeded, claim skipped, error text.

---

## 5. Implementation Guidelines

### Steps

1. `claimGuestMembershipsForUser`.
2. Session with user insert.
3. Verify expense still references same memberId.
4. Never `GroupMember.create` for the new user in those groups.

### Security

- Only claim guests with that email (cannot claim someone else's guest).
- Invite token hashed compare.

---

## 6. Dependencies

- 0.2 signup
- 3.2–3.4 guest + invite
- 5.x expenses using GroupMember._id

---

## 7. Acceptance Criteria

- [ ] Signup with a guest's email sets `GroupMember.user` and `memberType: registered`.
- [ ] `GroupMember._id` is **unchanged**.
- [ ] No second member row; expense/transfer history still points at the same id.
- [ ] Multiple groups with that guest email are all claimed.
- [ ] Unique `(group, user)` still holds.

**Out of scope:** login-time pending claims UI (7.2); auto-linking accounts.
