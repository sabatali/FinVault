# Feature 4.2 — Default / Primary Account per Group

> **Project:** FinVault  
> **Phase:** 4 — Linking Accounts to Groups  
> **Feature ID:** 4.2  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth

## Context for the Implementer

Project acceptance: *New group expense defaults to this account as the payer source.*

Each **registered** `GroupMember` has at most **one** primary `GroupMemberAccount` in a given group (`isPrimary: true`). When they create a `GroupExpense` in Phase 5, the payer account `<select>` **defaults** to this account. They can still pick another linked account.

This feature is the UX + API to **set** the primary flag. Expense form defaulting is verified in Phase 5; here you can still implement `GET` that returns `primaryAccountId` for the current member so 5.1 consumes it.

---

## 1. Feature Overview

### Purpose

Let a registered member mark one linked account as the default payer source for a group.

### Business objective

Reduce mistakes (wrong wallet) and speed up logging a shared bill.

### User story

> As a member, I want to set my HBL account as the default for "Flatmates" so new group expenses start with that account selected.

---

## 2. Functional Requirements

### Complete feature behavior

1. Exactly one primary per (groupMember, group). Setting a new primary **unsets** the previous in the same session.
2. Primary must already be a linked account (4.1). Cannot primary an unlinked account.
3. If the user unlinks the primary (4.1), automatically promote another linked account if any, else none.
4. UI: radio or "Set as default" on each linked account; badge "Default".
5. `GET /api/groups/[id]/linked-accounts` includes `isPrimary`.

### Validation rules

- Body `{ accountId }` or `{ linkId }` must be the current user's link.
- Guest: 400.

### User interactions

- Click "Make default"; previous default badge moves.
- Expense form (if 5.1 exists): default option selected.

### Edge cases

- No linked accounts: settings message, no primary.
- Only one linked: it should be primary (4.1 first-link behavior).
- Concurrent two-primary: unique partial index if Mongo supports `{ groupMember: 1 }` unique where `isPrimary: true` — **partial unique index** `{ groupMember: 1 }` with `partialFilterExpression: { isPrimary: true }`.

---

## 3. Technical Requirements

### Database

Reuse `GroupMemberAccount.isPrimary`. Add partial unique index.

### APIs

**`PUT /api/groups/[id]/primary-account`** `{ "accountId": "..." }`

Returns `{ primaryAccountId }`.

### Phase 5 contract

Group expense create: if `payerAccountId` omitted, use primary; if no primary, 400 `NO_PAYER_ACCOUNT`.

### Background jobs

None.

---

## 4. UI/UX Requirements

### Components

- Extend `LinkedAccounts.tsx` with default control.

### States

- Success: "HBL Current is your default for this group."
- Error: account not linked.

### Responsive / a11y

Radios in a `fieldset` "Default account for group expenses".

---

## 5. Implementation Guidelines

### Steps

1. Partial unique index.
2. PUT handler: session unset all primary for member, set one.
3. Unlink hook from 4.1.
4. UI radios.

### Security

- Only own links.

---

## 6. Dependencies

- 4.1 linked accounts
- Phase 5 will consume the default (document the contract)

---

## 7. Acceptance Criteria

- [ ] User can set a default/primary account per group.
- [ ] Only one primary exists at a time for that member+group.
- [ ] GET linked accounts shows which is primary.
- [ ] Unlinking primary reassigns or clears primary safely.
- [ ] (If Phase 5 already present) new group expense form defaults to this account.

**Out of scope:** actually debiting the account (5.3); guests.
