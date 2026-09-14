# Feature 5.2 — GroupExpense: Manual Split

> **Project:** FinVault  
> **Phase:** 5 — Group Expenses (Money Moves for Real)  
> **Feature ID:** 5.2  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth

## Context for the Implementer

Project: *Custom split amounts sum exactly to the total expense.*

Extend Feature 5.1's `GroupExpense` with `splitType: "manual"`. The payer still pays (and is debited) the **full** total; participants get **exact** `shareAmount` values entered by the user.

Reuse the same model, list UI, ledger debit (5.3), and account-linking rules as equal split. Do not create a second collection.

---

## 1. Feature Overview

### Purpose

Allow the payer to specify each participant's exact share, with server-side enforcement that shares sum to the expense total.

### Business objective

Real-world bills are often not equal (one person skipped dessert). FinVault must still keep the ledger and bookkeeping consistent.

### User story

> As a payer, I want to split PKR 2500 as 1000 / 1000 / 500 across three members so the shares match what we agreed, and still debit my account 2500.

---

## 2. Functional Requirements

### Complete feature behavior

1. Create/update form mode **Manual**: an amount input per selected participant.
2. Server validates `sum(shares) === amount` after `roundAmount` on each share and on total (use integer paisa comparison to avoid 0.01 drift).
3. Participants with share `0` should not be included **or** allow 0 only if explicitly selected — **recommended: share must be `> 0`** for every included participant; unselected members are omitted.
4. Same debit behavior as equal: full total on payer's account.
5. Switching Equal ↔ Manual in the UI: Equal fills even shares; Manual starts from those values for editing.

### Validation rules

- `shares`: array `{ memberId, amount }` matching `participantMemberIds`.
- Sum must equal total; else 400 `{ code: "SHARES_MUST_SUM_TO_TOTAL", expected, actual }`.
- No duplicate memberIds.
- All members in the group.

### User interactions

- Split type toggle.
- Running "Remaining" helper: `total - sum(inputs)` must hit 0.00 to enable submit.
- Disable submit while remaining ≠ 0.

### Edge cases

- User types 33.333: round to 2 decimals per field; then sum check.
- One person 100% : allowed (others not selected).
- Negative share: 400.
- Client tampering: server is source of truth (ignore equal computation).

---

## 3. Technical Requirements

### Database

Same `groupexpenses` with `splitType: "manual"` and `participants[].shareAmount`.

### APIs

Same POST `/api/groups/[id]/expenses` with `splitType: "manual"` and `shares`.

`lib/splits.ts` — `assertSharesSumToTotal(total, shares)`.

### Background jobs

None.

---

## 4. UI/UX Requirements

### Components

- `SplitTypeToggle`
- `ManualSplitInputs` with remaining indicator (green at 0, red otherwise)

### States

- Remaining ≠ 0: inline error, submit disabled.
- Success: same as 5.1.

### Responsive / a11y

Each share input labeled with member name. Remaining announced (`aria-live="polite"`).

---

## 5. Implementation Guidelines

### Steps

1. Extend POST validation branch on `splitType`.
2. Compare sums in **paisa integers**: `Math.round(n * 100)`.
3. UI remaining calculator using the same rounding.
4. Tests: 2500 = 1000+1000+500 OK; 1000+1000+400 → 400 error.

### Security

- Server re-validates sum; never trust client `isValid`.

---

## 6. Dependencies

- 5.1 GroupExpense equal + debit pipeline
- 4.x payer account

---

## 7. Acceptance Criteria

- [ ] Custom split amounts **sum exactly** to the total (server-enforced).
- [ ] Invalid sums are rejected; no expense and no Transaction written.
- [ ] Valid manual split still debits the payer's account for the **full** total.
- [ ] UI remaining helper reaches 0.00 for a successful submit.
- [ ] Equal vs manual both appear in the same expense list with share details.

**Out of scope:** reverse on edit (5.4), settlement suggestions (6.4).
