# Feature 5.4 — Edit / Delete Group Expense (Reverse Linked Transaction)

> **Project:** FinVault  
> **Phase:** 5 — Group Expenses (Money Moves for Real)  
> **Feature ID:** 5.4  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth · MongoDB sessions

## Context for the Implementer

Project docs: *the tradeoff is added complexity around editing or deleting a group expense (the linked `Transaction` must be found via `sourceId` and reversed/adjusted, not just recomputed).*

Acceptance: *Account balance returns to pre-expense state after delete.*

Use Feature 1.2's `reverseLedgerEntriesForSource({ sourceType: "group_expense", sourceId })` then delete or update the `GroupExpense` in the **same session**.

**Who can edit/delete:** the `createdBy` user **or** a group admin **or** the payer — pick **createdBy or admin** to avoid chaos; document it. Recommended: **admin or the member who created it**.

After edit of amount/payer/account/shares: reverse old debit, post new debit (registered payer), update participants. Unique index requires reverse (delete tx) before new post.

---

## 1. Feature Overview

### Purpose

Make group expenses mutable/deletable without leaving orphan ledger rows or drifted balances.

### Business objective

People mistype amounts; FinVault must correct real money, not only the split table.

### User story

> As the person who logged dinner, I want to delete it (or fix the amount) and see my account balance return to how it was before that bill.

---

## 2. Functional Requirements

### Complete feature behavior

1. **DELETE** expense: reverse ledger (if any), delete document. Balance = pre-expense.
2. **PATCH** expense: validate like create (equal or manual); reverse; apply new fields; post new debit if registered payer.
3. UI: edit page + delete confirm on expense detail.
4. If expense already has **settlements that depend on it** (Phase 6): either 409 `EXPENSE_HAS_SETTLEMENTS` or allow edit and let 5.5 balances recompute from remaining expenses — **recommended: allow edit/delete of expenses independently of transfers** (transfers are separate money movements). Balances (5.5) always recompute from current expenses + confirmed transfers. No extra lock.

### Validation

- Same as create for PATCH body.
- Forbidden for non-eligible users: 403.

### User interactions

- Edit form prefilled; delete "This will credit the payer's account by PKR X" (i.e. reverse the debit).

### Edge cases

- Guest payer delete: no ledger, just delete doc.
- Payer changed from registered to guest on edit: reverse debit, no new tx.
- Guest to registered: post new debit (need account).
- Concurrent edit: last write wins inside transactions; retry on write conflict.

---

## 3. Technical Requirements

### APIs

| Method | Path |
|---|---|
| GET | `/api/groups/[id]/expenses/[expenseId]` |
| PATCH | same |
| DELETE | same |

Session required.

### Background jobs

None.

---

## 4. UI/UX Requirements

### Pages

- `/groups/[id]/expenses/[expenseId]`
- `/groups/[id]/expenses/[expenseId]/edit`

### States

- **Success delete:** redirect to group, toast, balance restored.
- **Error:** 403, 404, validation.

### a11y

Delete dialog with amount in the title text.

---

## 5. Implementation Guidelines

### Steps

1. `updateGroupExpense` / `deleteGroupExpense` services.
2. Always reverse-by-sourceId, never by guessing amounts from cache.
3. Tests: start 10000, expense 3000 → 7000, delete → 10000. Edit 3000→2000 → 8000.

### Security

- Access control.
- Atomicity.

---

## 6. Dependencies

- 5.1–5.3
- 1.2 `reverseLedgerEntriesForSource`

---

## 7. Acceptance Criteria

- [ ] After delete, payer account balance returns to the **pre-expense** state.
- [ ] No orphan `Transaction` with `sourceType: group_expense` for a deleted expense.
- [ ] Edit amount/account results in exactly one current debit matching the new total.
- [ ] Unauthorized users cannot edit/delete.
- [ ] Guest-payer expenses delete without ledger errors.

**Out of scope:** settlement confirmations (Phase 6); hardening suite (8.4) though your tests here become part of that later.
