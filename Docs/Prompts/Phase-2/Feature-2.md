# Feature 2.2 — Personal Income Model (Credit Transaction)

> **Project:** FinVault  
> **Phase:** 2 — Individual Income & Expenses  
> **Feature ID:** 2.2  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth · date-fns or dayjs

## Context for the Implementer

FinVault's ledger is the single source of truth. Personal **income** (salary, refund, gift) must **increase** a real `Account` by writing a **credit** `Transaction` with `sourceType: "income"` and `sourceId` pointing at the `Income` document.

Mirror Feature 2.1 (`Expense`) as closely as possible: same atomic session pattern, same reverse-on-edit/delete, same ownership rules. Do **not** invent a second way to bump `cachedBalance`.

**Currency:** PKR base. FX is Phase 8.2.  
**Categories:** Feature 2.3; optional `categoryId`.  
**Recurring salary:** explicitly **out of scope** (listed as a future consideration in project docs).

---

## 1. Feature Overview

### Purpose

Record personal income against a user-owned account, persisting an `Income` document and a matching credit ledger entry.

### Business objective

Users see money in and money out on the same ledger, so "what I have" includes paychecks, not only spending.

### User story

> As a user, I want to add income to an account so that my balance increases by exactly that amount.

---

## 2. Functional Requirements

### Complete feature behavior

1. `Income` model: user, account, amount, currency, date, description, optional category, `transactionId`.
2. **Create:** owned account; session: save Income + `postLedgerEntry` **credit**.
3. **List / get / update / delete** — same semantics as expenses, but ledger direction is credit. Update amount: reverse old credit, post new credit.
4. UI: `/income` (or `/incomes`) list + form. Add **Income** to the app shell nav.

### Validation rules

Same as expenses: `amount > 0`, account owned, date not > 1 day future, description max 200.

### User interactions

- Add income: account, amount, date, description.
- List with filters (account, date range).
- Edit / delete with confirm on delete.
- No negative-balance warning needed on create (credits increase balance); still allow whatever the new balance is.

### Edge cases

- Same as 2.1 (ownership, atomicity, unique source index, double-submit).
- Do not allow a single document to be both income and expense.
- Deleting income **decreases** the account again (reverse the credit).

---

## 3. Technical Requirements

### Architecture considerations

Keep `Income` as its own collection (project data model lists `Income` separately from `Expense`). Do not overload Expense with a type flag unless you already did — **follow the documented models**: separate `Income` collection.

### Database models/tables

**Collection: `incomes`**

```ts
{
  user: ObjectId;
  account: ObjectId;
  amount: number;
  currency: string;
  description: string;
  category: ObjectId | null;
  occurredAt: Date;
  transactionId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: `{ user: 1, occurredAt: -1 }`, `{ account: 1, occurredAt: -1 }`.

### APIs and services

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/income` | List with filters. |
| POST | `/api/income` | Create + credit. |
| GET | `/api/income/[id]` | One if owned. |
| PATCH | `/api/income/[id]` | Update + ledger adjust. |
| DELETE | `/api/income/[id]` | Reverse + delete. |

Use `/api/income` (singular resource name) **or** `/api/incomes` — pick one and use it consistently in the UI.

### Background jobs or schedulers

None.

---

## 4. UI/UX Requirements

### Pages or components involved

- Nav: Income
- `app/(app)/income/page.tsx` (and new/edit)
- `components/income/IncomeForm.tsx`
- `components/income/IncomeList.tsx`

Visual language: credits/income in a success/green amount style; expenses remain debit/red from 2.1.

### Loading, empty, success, and error states

- **Empty:** "No income recorded yet. Add salary or other money in."
- **Loading / error / success:** match expense screens for a consistent product.

### Responsive behavior

Same as expense list (table → cards).

### Accessibility considerations

Same form labeling and dialogs as 2.1.

---

## 5. Implementation Guidelines

### Step-by-step implementation approach

1. Copy the Expense flow; switch `entryType` to `"credit"` and `sourceType` to `"income"`.
2. Shared form primitives (amount, account select, date) to avoid two inconsistent UIs.
3. Verify account detail: credit row, balance increases by exact amount.
4. Verify delete restores prior balance.

### Recommended file structure

```text
models/Income.ts
app/api/income/route.ts
app/api/income/[id]/route.ts
app/(app)/income/...
components/income/
```

### Best practices

- Extract `lib/personal-entry.ts` only if it reduces duplication without hiding ledger calls.
- Always `roundAmount`.

### Performance optimizations

- Paginated list.

### Security considerations

- IDOR on account and income id.
- Atomic session create/update/delete.

---

## 6. Dependencies

### Required features or services

- 1.2 Ledger (`postLedgerEntry`, `reverseLedgerEntriesForSource`)
- 1.3–1.4 Accounts UI
- 2.1 is not a hard code dependency but **match its UX and API shape**

### External libraries

- `date-fns` or `dayjs`
- `mongoose`

### Prerequisites

- At least one account.

---

## 7. Acceptance Criteria

- [ ] Adding income **increases** account balance by the exact amount.
- [ ] Exactly one `Transaction` with `sourceType: "income"` and `sourceId` = income id.
- [ ] Account history shows a credit.
- [ ] Delete restores the previous balance; no orphan transactions.
- [ ] Edit amount/account results in a ledger that matches the new values only.
- [ ] Cannot attach income to another user's account.
- [ ] Unauthenticated requests fail.

**Out of scope:** categories UI (2.3), dashboard charts (2.4), group transfers (Phase 6), recurring income.
