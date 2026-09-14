# Feature 7.2 — Global Pending Claims Prompt on Login

> **Project:** FinVault  
> **Phase:** 7 — Guest Claim Flow  
> **Feature ID:** 7.2  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth

## Context for the Implementer

Acceptance: *New user sees any guest profiles matching their email and can claim them.*

7.1 auto-claims on signup. This feature covers:

1. Users who **already had** a FinVault account **before** someone added them as a guest with that email (3.3 should have added them as **registered** if the User existed — but a guest might still be created if they were added with a typo then fixed, or if add-guest happened while lookup failed). Also: **login** after 7.1 failed mid-air.
2. The **global prompt**: on login / app shell load, `GET /api/claims/pending` returns unclaimed guests with matching email. UI modal: list groups, **Claim** / **Not me**.

"New user" in the plan includes first logins after signup; show the prompt until there are zero pending guests for that email.

**Claim** uses the same `claimGuestMembershipsForUser` but for **one** member id the user selected (or all). **Not me** should **not** steal the guest; just dismiss for the session (localStorage) — do **not** delete the guest (admin may have used the email by mistake; deleting would destroy history). Optional `dismissedClaimIds` on User is overkill; session dismiss is enough. If they ignore forever, keep showing on each login until claimed — **better**: persist `User.dismissedGuestMemberIds` so "Not me" is sticky.

If they Claim, preserve `_id` as in 7.1.

---

## 1. Feature Overview

### Purpose

Surface unmatched guest profiles that share the logged-in user's email and let them claim (or dismiss) from anywhere in the app.

### Business objective

No silent leftover guests after a user already exists; membership and history stay unified.

### User story

> After I log in, FinVault tells me "You were added as a guest in Flatmates" and I can claim that profile in one click.

---

## 2. Functional Requirements

### Complete feature behavior

1. `GET /api/claims/pending` — guests with same email, `user: null`.
2. `POST /api/claims` `{ memberIds: string[] }` — claim those if email matches current user.
3. `POST /api/claims/dismiss` `{ memberIds }` — persist dismiss.
4. App shell (0.3): if pending.length > 0 (minus dismissed), show modal once per session until claimed.
5. Works after login **and** after signup if 7.1 left any (should be none).

### Validation

- Can only claim guests whose email === current user email.
- Cannot claim already registered members.

### User interactions

- Modal: group name, role, "Claim" "Skip".
- Multi-select if several groups.

### Edge cases

- Email change is not supported (no email update feature); if added later, pending uses stored User.email.
- User dismisses then wants to claim: Settings → "Pending group invites" list (simple page `/claims`).

---

## 3. Technical Requirements

### User model addition

`dismissedGuestMemberIds: ObjectId[]` optional.

### APIs

As above; all auth required.

Reuse `lib/claim.ts`.

### Background jobs

None.

---

## 4. UI/UX Requirements

### Components

- `PendingClaimsModal.tsx` in AppShell
- `/claims` page for skipped items

### States

- **Empty:** don't show modal.
- **Loading:** don't flash empty then modal (wait for GET).
- **Success:** modal closes, groups appear in `/groups` list.
- **Error:** "Could not claim; try again."

### Responsive / a11y

Focus trap modal; Escape = skip for now (session) not dismiss forever — primary buttons explicit.

---

## 5. Implementation Guidelines

### Steps

1. Pending GET.
2. Claim POST → same preserve `_id`.
3. Modal in `(app)/layout`.
4. After claim, `router.refresh()` group list.

### Security

- Email match enforced server-side (never trust client memberIds without email check).

---

## 6. Dependencies

- 7.1 claim helper
- 0.2–0.3 auth + shell
- 3.2 guests

---

## 7. Acceptance Criteria

- [ ] After login, the user sees guest profiles matching their email (modal or claims page).
- [ ] Claim preserves `GroupMember._id` and does not duplicate history.
- [ ] Claimed groups show up in the user's group list as registered membership.
- [ ] Users cannot claim guests with a different email.
- [ ] Dismiss/skip does not delete guest history.

**Out of scope:** merging two registered members; changing email.
