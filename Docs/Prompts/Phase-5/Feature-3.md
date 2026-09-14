# Feature 5.3 — Real Account Debit on Group Expense (`group_expense`)

> **Project:** FinVault  
> **Phase:** 5 — Group Expenses (Money Moves for Real)  
> **Feature ID:** 5.3  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · JWT auth · MongoDB sessions

## Context for the Implementer

Project acceptance: *Single `Transaction` row created, `sourceId` points back to the expense.* Tagged **`group_expense`**.

This feature is the **ledger contract** for 5.1/5.2. If those already post a debit, audit and align them to this spec. If not, wire it now.

**Rules recap:**

- Registered payer with linked `payerAccount`: **exactly one** debit `Transaction` for the **full expense amount** (not the payer's share).
- `sourceType: "group_expense"` (enum value used in Feature 1.2).
- `sourceId: GroupExpense._id`.
- Unique index `(sourceType, sourceId, account)` guarantees a single row per expense per account.
- Guest payer: **zero** transactions.
- `Account.cachedBalance` updates only via `postLedgerEntry`.
- Description on the transaction: group name + expense description, e.g. `Flatmates · Dinner`.

Do **not** write transactions for other participants' shares (they did not pay cash). Shares exist only on `GroupExpense.participants` until they settle (Phase 6).

---

## 1. Feature Overview

### Purpose

Guarantee every registered-payer group expense writes one real ledger debit linked by `sourceId`.

### Business objective

The personal dashboard and account detail immediately reflect group activity — the core product promise.

### User story

> When I pay for the group, my account history shows a group expense debit for the full bill, linked to that expense.

---

## 2. Functional Requirements

### Complete feature behavior

1. Centralize in `lib/group-expense-ledger.ts`: `postGroupExpenseDebit(expense, session)` and use it from create (and later 5.4 reverse).
2. Account detail (1.4) already displays `sourceType`; add label **"Group expense"** and optional link to `/groups/[groupId]/expenses/[expenseId]`.
3. If create succeeds without a transaction for a registered payer → **bug**; abort the session.

### Validation

- `payerAccount` owner must match the registered payer's `User`.
- Amount on Transaction equals `GroupExpense.amount`.

### Edge cases

- Missing linked account: 400, no expense.
- Double create: unique index.
- Payer is registered but account belongs to someone else: 400.

---

## 3. Technical Requirements

### Transaction document

```ts
{
  entryType: "debit",
  amount: expense.amount,
  sourceType: "group_expense",
  sourceId: expense._id,
  account: expense.payerAccount,
  user: payerUserId,
  description: `${group.name} · ${expense.description}`
}
```

### APIs

No new public route required. Group expense POST is the trigger. Optional `GET` expense includes `transactionId`.

### Background jobs

None.

---

## 4. UI/UX Requirements

### Account history

- Source column: "Group expense"
- Click-through to the group expense if possible

### Group expense detail

- Show "Debited from HBL Current · PKR 3,000" or "Guest payer — no account debit"

### States

If ledger fails, user sees error, no half-created expense.

---

## 5. Implementation Guidelines

### Steps

1. Audit 5.1/5.2 create path.
2. Extract helper; require session.
3. Labels in `lib/ledger-labels.ts`.
4. Manual test: Compass one row, `sourceId` matches, balance delta exact.

### Security

- Ownership of payer account.
- Atomic session.

---

## 6. Dependencies

- 1.2 ledger
- 5.1/5.2 GroupExpense
- 4.1 payer account

---

## 7. Acceptance Criteria

- [ ] Single `Transaction` row created for a registered payer.
- [ ] `sourceType` is `group_expense` and `sourceId` points at the expense.
- [ ] Amount equals the full expense total.
- [ ] Guest payer → no transaction.
- [ ] Failed ledger write rolls back the expense document.

**Out of scope:** credits to other members; settlements (Phase 6); edit reverse (5.4).
