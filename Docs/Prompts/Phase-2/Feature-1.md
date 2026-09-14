# Feature 2.1 — Personal Expense Model (Debit Transaction)

> **Project:** FinVault  
> **Phase:** 2 — Individual Income & Expenses  
> **Feature ID:** 2.1  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth · date-fns or dayjs

## Context for the Implementer

FinVault is a personal + group finance app. A user's **`Account` balance is the single source of truth**. Adding a personal grocery run must **reduce that real account immediately** by writing a **debit** `Transaction` with `sourceType: "expense"` and `sourceId` pointing at the `Expense` document.

**Never** decrement `cachedBalance` except through `lib/ledger.ts` (`postLedgerEntry`) from Feature 1.2.

**MongoDB session:** creating an Expense + posting the ledger row must be **atomic** (both succeed or both roll back).

**Currency:** store the expense amount in PKR base (account currency is PKR by default). Do not implement FX here (Phase 8.2).

**Categories:** tagging is Feature 2.3. In this feature, allow an optional `category` string or `categoryId` if 2.3 already landed; otherwise a free-text `category` field of max 40 chars **or** omit category until 2.3. Preferred: optional `categoryId: ObjectId | null` so 2.3 can attach without a migration.

**Groups:** this is **personal** expense only — not `GroupExpense` (Phase 5).

**Negative balances:** allowed. Warn in the UI if the expense would take the account below zero, but **do not block**.

---

## 1. Feature Overview

### Purpose

Let a registered user record a personal expense against one of their accounts, persisting an `Expense` document and a matching debit ledger entry.

### Business objective

Capture everyday spending in the same ledger that will later also hold group dinners, so the dashboard is one true picture of money out.

### User story

> As a user, I want to add an expense to an account (amount, date, note) so that my account balance drops by exactly that amount.

---

## 2. Functional Requirements

### Complete feature behavior

1. `Expense` model: user, account, amount, currency, date, description/note, optional category, `transactionId` (ref to the ledger row).
2. **Create:** validate account ownership; in a session: insert Expense, `postLedgerEntry` debit, save `transactionId` on Expense (or set Expense id first then post with `sourceId: expense._id`).
3. **List:** personal expenses for the current user, filterable by account and date range (basic).
4. **Get one:** if owned.
5. **Update:** if amount, account, or date changes, **reverse** the old ledger row and post a new one in the same session (or reverse + post). Description-only edits do not touch the ledger. Changing account moves the debit to the new account.
6. **Delete:** reverse ledger entry (balance returns to pre-expense), delete Expense. No orphan transactions.
7. UI: `/expenses` list + add/edit forms; also a shortcut from account detail (optional but useful).

### Validation rules

| Field | Rules |
|---|---|
| `accountId` | Required, must belong to current user. |
| `amount` | Required, `> 0`, max 1e12, 2 decimal places. |
| `occurredAt` / `date` | Required, valid date, not more than 1 day in the future (allow today). Past dates OK. |
| `description` | Optional, max 200 chars. |
| `categoryId` | Optional; if present must exist (when 2.3 exists). |

### User interactions

- Nav: add **Expenses** to the app shell (Feature 0.3 nav list).
- Add expense: pick account, amount, date, description.
- If post-expense balance would be negative, show a warning banner, still allow submit.
- List shows amount, account name, date, description.
- Edit and delete with confirmation on delete.

### Edge cases

- Account deleted / not owned → 400/404, no expense created.
- Ledger unique index: one transaction per expense per account.
- Edit amount from 100 to 40: net effect on account is +60 (reverse 100, debit 40).
- Concurrent double-submit: unique source index should prevent double debit; show error.
- Very old dates: allowed.

---

## 3. Technical Requirements

### Architecture considerations

`models/Expense.ts` + `app/api/expenses` + `lib/ledger.ts`. Always pass `sourceType: "expense"`.

### Database models/tables

**Collection: `expenses`**

```ts
{
  user: ObjectId;
  account: ObjectId;
  amount: number;          // > 0, PKR
  currency: string;
  description: string;
  category: ObjectId | null;
  occurredAt: Date;
  transactionId: ObjectId; // ref Transaction
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: `{ user: 1, occurredAt: -1 }`, `{ account: 1, occurredAt: -1 }`.

### APIs and services

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/expenses` | List (`accountId`, `from`, `to`, `page`). |
| POST | `/api/expenses` | Create + debit. |
| GET | `/api/expenses/[id]` | One if owned. |
| PATCH | `/api/expenses/[id]` | Update + ledger adjust. |
| DELETE | `/api/expenses/[id]` | Reverse + delete. |

POST 201 returns expense including new `accountCachedBalance` (optional convenience).

### Background jobs or schedulers

None (recurring expenses are an open future item — do not build).

---

## 4. UI/UX Requirements

### Pages or components involved

- Shell nav item Expenses → `/expenses`
- `app/(app)/expenses/page.tsx`
- `app/(app)/expenses/new/page.tsx`
- `app/(app)/expenses/[id]/edit/page.tsx`
- `components/expenses/ExpenseForm.tsx`
- `components/expenses/ExpenseList.tsx`

### Loading, empty, success, and error states

- **Loading:** table skeleton.
- **Empty:** "No expenses yet. Record your first purchase."
- **Success:** toast "Expense added"; list updates; account balance on 1.3/1.4 drops.
- **Error:** validation under fields; 409/500 generic.

### Responsive behavior

Desktop table; mobile cards. Amount in a clear debit style.

### Accessibility considerations

Labeled form fields; delete confirm dialog; date input accessible (`type="date"` plus label).

---

## 5. Implementation Guidelines

### Step-by-step implementation approach

1. Expense schema.
2. Create handler with `session.withTransaction`:
   - create expense `_id` first (`new ObjectId()`)
   - `postLedgerEntry({ entryType: "debit", sourceType: "expense", sourceId: expenseId, amount, accountId, ... })`
   - `expense.transactionId = tx._id`; save expense
3. Delete: `reverseLedgerEntriesForSource({ sourceType: "expense", sourceId })` then delete expense.
4. Update: reverse old, apply new (or compute delta — **prefer reverse + post** for a clean audit trail of the *current* source; do not leave extra transactions for the same source because of the unique index — reverse deletes the old row, then post).
5. Build UI and nav link.
6. Verify on account detail: one new debit row, balance matches.

### Recommended file structure

```text
models/Expense.ts
app/api/expenses/route.ts
app/api/expenses/[id]/route.ts
app/(app)/expenses/...
components/expenses/
```

### Best practices

- Reuse `formatMoney`, `roundAmount`.
- Shared `ExpenseForm` for create/edit.
- Select accounts from `GET /api/accounts`.

### Performance optimizations

- List pagination (20–50).
- Do not load all accounts' full transaction histories.

### Security considerations

- Account must belong to user (IDOR).
- Amounts only via validated body.
- Atomic session so a failed ledger post cannot leave an expense without a debit (or vice versa).

---

## 6. Dependencies

### Required features or services

- 1.1–1.4 Accounts + ledger + detail page (to visually confirm debit)
- 0.3 nav shell (add Expenses link)

### External libraries

- `date-fns` or `dayjs`
- `mongoose` sessions

### Prerequisites

- User has at least one account.
- MongoDB replica set for transactions.

---

## 7. Acceptance Criteria

- [ ] Adding an expense reduces the account balance by the **exact** amount.
- [ ] Exactly one `Transaction` is written with `sourceType: "expense"` and `sourceId` = expense id.
- [ ] Account detail history shows the debit.
- [ ] Deleting the expense restores the previous balance and removes the ledger row (no orphans).
- [ ] Editing the amount/account adjusts the ledger so the account reflects the new amount only.
- [ ] Expense on another user's account is impossible (400/404).
- [ ] Unauthenticated access is rejected.
- [ ] Negative resulting balance is allowed, with a UI warning on create.

**Out of scope:** income (2.2), category catalog (2.3), group expenses (Phase 5), recurring expenses.
