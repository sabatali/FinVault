# Feature 6.2 — Auto-Confirm Transfers Involving a Guest

> **Project:** FinVault  
> **Phase:** 6 — Settlements / Transfers  
> **Feature ID:** 6.2  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth

## Context for the Implementer

Project: *Any transfer involving a **guest**: **auto-confirmed**, since a guest can't log in to confirm anything themselves.*

Acceptance: *Transfer involving a guest settles immediately, no confirm step shown.*

If **either** `fromMember` or `toMember` is `memberType: guest`, create with `status: "auto_confirmed"` and skip pending UI.

**Ledger (6.3):**

- Guest has no Account.
- If **sender is registered** and **receiver is guest**: debit sender's account only (money left FinVault to cash/guest). One debit Transaction. No credit.
- If **sender is guest** and **receiver is registered**: credit receiver's account only (money entered from guest). One credit Transaction. No debit.
- If **both guests**: no Transactions at all (pure bookkeeping). Still auto-confirm so 5.5 nets move.

Implement create-path branching in POST `/transfers`. Reuse 6.3 helpers: `applyTransferLedger(transfer, session)` which no-ops missing accounts.

---

## 1. Feature Overview

### Purpose

Settle guest-side transfers immediately without a confirm UI.

### Business objective

Groups with non-users can still record "Ali (guest) paid Ayesha" without a login.

### User story

> As an admin, when I record a settlement that includes a guest, it completes at once — I never see Confirm/Reject for that transfer.

---

## 2. Functional Requirements

### Complete feature behavior

1. POST transfer: if either side guest → `auto_confirmed`, run ledger helper, no pending.
2. Confirm/reject APIs return 400 `NOT_PENDING` for auto_confirmed.
3. UI: no confirm buttons; badge "Auto-confirmed (guest)".
4. Group nets update immediately (5.5 includes auto_confirmed).

### Validation

- Same amount/member rules as 6.1.
- Registered side still needs a linked account when they are the one who must be debited or credited.

### User interactions

- Settlement form allows picking guests.
- Success toast "Settled immediately because a guest is involved."

### Edge cases

- Both registered → still pending (6.1), do not auto-confirm.
- Guest-guest: allowed, bookkeeping only.
- After claim (Phase 7), **historical** auto-confirmed transfers stay as they were; do not rewrite status.

---

## 3. Technical Requirements

### APIs

Same POST as 6.1 with server-side branch.

### Ledger

See 6.3; this feature must **call** it for auto_confirmed.

### Background jobs

None.

---

## 4. UI/UX Requirements

- Hide confirm/reject for `auto_confirmed`.
- Explain in helper text why it was instant.

### States

Success immediate; error if registered party has no linked account when a tx is required.

---

## 5. Implementation Guidelines

### Steps

1. `involvesGuest(from, to)` helper.
2. Branch in POST.
3. Tests: guest-receiver, guest-sender, both guests, both registered (still pending).

### Security

- Still require the **logged-in** user to be a registered member of the group (guests never call the API).
- Creating a transfer "from" another registered user should follow 6.1 policy (usually sender = self). For guest sender, current user is logging on their behalf — **admin or any member** may record it; show confirmation copy.

---

## 6. Dependencies

- 6.1 model
- 6.3 ledger apply
- 3.2 guest members

---

## 7. Acceptance Criteria

- [ ] Transfer involving a guest settles immediately (`auto_confirmed`).
- [ ] No confirm step is shown in the UI.
- [ ] Both-registered transfers remain pending.
- [ ] Group balances (5.5) update at once for auto-confirmed transfers.
- [ ] Guest-guest creates no Account transactions.

**Out of scope:** claim flow (Phase 7).
