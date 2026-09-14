# Feature 4.1 — GroupMemberAccount: Link Personal Accounts to a Group

> **Project:** FinVault  
> **Phase:** 4 — Linking Accounts to Groups  
> **Feature ID:** 4.1  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth

## Context for the Implementer

Group bookkeeping must stay in sync with **real money**. `GroupMemberAccount` links a **registered** `GroupMember`'s personal `Account`(s) to a group so that when they pay for a group dinner (Phase 5), FinVault knows **which account to debit**.

Project acceptance: *User can attach an account, sees it listed in group settings.*

**Guests cannot link accounts** — they have no `Account`. UI and API must reject guest links.

A member may link **one or more** accounts (docs: "one or more"). Default/primary is Feature 4.2; this feature can set the first linked account as primary so 5.x has a payer source even if 4.2 is not finished — **if you set `isPrimary` here, 4.2 owns the UX to change it**.

The personal `Account` remains owned by the User; this is a **join** record, not a copy of the balance.

---

## 1. Feature Overview

### Purpose

Allow a registered group member to attach one or more of their FinVault accounts to a group and see them in group settings.

### Business objective

Without this link, group expenses cannot debit real accounts (Option A ledger design).

### User story

> As a registered member of "Flatmates", I want to attach my HBL account (and maybe Cash) to the group so future shared expenses can come from that account.

---

## 2. Functional Requirements

### Complete feature behavior

1. `GroupMemberAccount` model: group, groupMember, account, `isPrimary`.
2. **Attach:** current user attaches an account they **own**, via their GroupMember in that group.
3. **List:** in group settings, the current user sees **their** linked accounts. Admins may see a privacy-limited view: other members show "Linked" / "Not linked" **without** account balances or bank names of others — **recommended: each user only sees their own linked accounts**; payer selection in Phase 5 shows the payer's own accounts only.
4. **Detach:** user can unlink an account that is not needed. If it is the only account and primary, allow detach but Phase 5 must then require choosing an account at expense time. Block detach if you want a "must have one" rule — **allow zero linked** (warn in UI: "Link an account before adding expenses").
5. Cannot link another user's account.
6. Cannot link the same account twice to the same group.

### Validation rules

- `accountId` owned by `req.user`.
- `groupMember.user` === `req.user`.
- Guest member: 400 `GUEST_CANNOT_LINK_ACCOUNT`.
- Account currency should match group practice (PKR); if account currency ≠ PKR, 400 until Phase 8.2.

### User interactions

- Group page tab **Settings** or section "Your accounts in this group".
- Multi-select or "Link account" dropdown of user's accounts not yet linked.
- List with type + name + balance (own accounts only).
- Unlink with confirm.

### Edge cases

- User not in group → 404.
- Account already linked to this group → 409.
- Same account linked to **different** groups: **allowed** (one HBL can fund two trips).
- Deleted account: cannot attach; if account was deleted, hide/orphan cleanup 409 on use in Phase 5.

---

## 3. Technical Requirements

### Database

**Collection: `groupmemberaccounts`**

```ts
{
  group: ObjectId;
  groupMember: ObjectId;
  account: ObjectId;
  isPrimary: boolean; // default false; first link may be true
  createdAt: Date;
}
```

Unique `{ group: 1, account: 1 }` and unique `{ groupMember: 1, account: 1 }`.

### APIs

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/groups/[id]/linked-accounts` | Current user's links (+ account summaries). |
| POST | `/api/groups/[id]/linked-accounts` | `{ accountId }` |
| DELETE | `/api/groups/[id]/linked-accounts/[linkId]` | Unlink own. |

### Background jobs

None.

---

## 4. UI/UX Requirements

### Pages / components

- `app/(app)/groups/[id]/settings/page.tsx` or a section on group detail
- `components/groups/LinkedAccounts.tsx`

### States

- **Empty:** "Link a personal account so group expenses can debit real money."
- **Loading:** skeleton.
- **Success:** account appears in the list immediately.
- **Error:** not owned, duplicate, guest.

### Responsive / a11y

Labeled select; unlink button `aria-label`.

---

## 5. Implementation Guidelines

### Steps

1. Model + indexes.
2. APIs with membership + ownership checks.
3. Settings UI using `GET /api/accounts` minus already linked.
4. If first link, set `isPrimary: true` (aligns with 4.2).

### Security

- Never return other members' account ids or balances on this endpoint.
- IDOR on link id (must belong to current member).

---

## 6. Dependencies

- 1.1–1.3 personal accounts
- 3.2 GroupMember (registered)

### Libraries

- None new.

---

## 7. Acceptance Criteria

- [ ] User can attach an account they own.
- [ ] Attached account is listed in group settings (for that user).
- [ ] Guest cannot attach.
- [ ] Cannot attach another user's account.
- [ ] Duplicate link in the same group is rejected.
- [ ] Unlink works for the owner of the link.

**Out of scope:** setting/changing primary (4.2) except defaulting the first link; debiting on expense (Phase 5).
