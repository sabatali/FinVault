# Feature 1.4 — Account Detail: Balance & Transaction History

> **Project:** FinVault  
> **Phase:** 1 — Individual Accounts  
> **Feature ID:** 1.4  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth

## Context for the Implementer

FinVault's `Account` balance is the single source of truth, and that truth is the **`Transaction` ledger** (Feature 1.2). This page is where a user sees it: **current balance** plus a **history of every credit and debit** on that account.

**Acceptance from the project plan:** *Displayed balance always matches sum of that account's transactions.*

At this point in the product, history will mostly be `opening_balance` rows. Phase 2 will add `expense` / `income`; Phases 5–6 will add `group_expense` / `group_transfer`. Design the history row so new `sourceType` values render without a rewrite (label map + link when a source page exists).

Guests have no accounts; this page is registered-user only.

---

## 1. Feature Overview

### Purpose

Show one account's current balance and its full ledger history, with the guarantee that the headline balance equals the sum of credits minus debits.

### Business objective

Build trust: users can see *why* their balance is what it is, which becomes critical once group dinners start debiting the same account.

### User story

> As a user, I want to open an account and see its balance and every transaction so I know my FinVault number matches reality.

---

## 2. Functional Requirements

### Complete feature behavior

1. Route `/accounts/[id]` (protected).
2. Load account by id **and** `owner = current user`. Otherwise 404.
3. Header: name, type, currency, **displayed balance**.
4. Displayed balance **must** be computed as:

   `sum(amount where entryType=credit) - sum(amount where entryType=debit)`

   Compare to `cachedBalance`. If they differ, **do not silently show the cache**. Show the **ledger sum** as the user-facing balance (it is the source of truth) and log a server warning. Optionally show a non-alarming internal mismatch only in development. Phase 8.4 hardens this; for now prefer ledger sum.

5. Transaction list: date (`occurredAt`), description, source type label, debit column, credit column, running balance (optional but recommended: compute from oldest→newest or show newest first without running balance).
6. Default sort: `occurredAt` descending (newest first).
7. Pagination or "load more" if count > 50 (page size 50).

### Validation rules

- Invalid id → 404.
- Query `page` / `limit`: limit max 100.

### User interactions

- From `/accounts`, clicking a row/name navigates here.
- Back link to `/accounts`.
- No edit-transaction UI (ledger is immutable from this page).

### Edge cases

- Zero transactions: balance `0.00`, empty history state.
- Negative balance: display in a distinct style (e.g. red), not hidden.
- Mixed source types: unknown future types fall back to the raw `sourceType` string.
- Timezone: store UTC, display in the user's local timezone.

---

## 3. Technical Requirements

### Architecture considerations

- Server Component page can fetch account + first page of transactions.
- Or `GET /api/accounts/[id]` + `GET /api/accounts/[id]/transactions`.

### Database models/tables

Uses `accounts` and `transactions`. Index `{ account: 1, occurredAt: -1 }` from 1.2.

### APIs and services

**`GET /api/accounts/[id]`** — already in 1.3; include `cachedBalance` and optionally `ledgerBalance`.

**`GET /api/accounts/[id]/transactions?page=1&limit=50`**

```json
{
  "accountId": "...",
  "ledgerBalance": 15000.00,
  "cachedBalance": 15000.00,
  "page": 1,
  "limit": 50,
  "total": 1,
  "transactions": [
    {
      "id": "...",
      "entryType": "credit",
      "amount": 15000,
      "currency": "PKR",
      "sourceType": "opening_balance",
      "sourceId": "...",
      "description": "Opening balance",
      "occurredAt": "2026-08-26T00:00:00.000Z"
    }
  ]
}
```

Ownership check on every call.

### Background jobs or schedulers

None.

---

## 4. UI/UX Requirements

### Pages or components involved

- `app/(app)/accounts/[id]/page.tsx`
- `components/accounts/AccountHeader.tsx`
- `components/accounts/TransactionTable.tsx`
- Link from `AccountList` rows (Feature 1.3)

### Loading, empty, success, and error states

- **Loading:** header skeleton + table skeleton.
- **Empty history:** "No transactions yet. Add income or expenses to see them here." (those features come in Phase 2 — still use this copy).
- **Success:** balance + table.
- **Error:** 404 page "Account not found"; 500 retry.

### Responsive behavior

- Desktop: full table (Date, Description, Source, Debit, Credit).
- Mobile: stacked entries with amount colored (debit vs credit).

### Accessibility considerations

- `h1` is the account name.
- Table has headers; amounts use `aria-label` including "debit" or "credit".
- Negative balance not conveyed by color alone (include a text cue or minus sign).

---

## 5. Implementation Guidelines

### Step-by-step implementation approach

1. Add `GET /api/accounts/[id]/transactions` with pagination and `ledgerBalance` aggregation.
2. Implement aggregation: `$match` account, `$group` credits/debits, or two sums in code for small datasets — aggregation is preferred.
3. Build the detail page; wire list → detail.
4. Add `SOURCE_TYPE_LABELS` map in `lib/ledger-labels.ts`.
5. Write a manual test: opening 1000, displayed 1000.00, one row.

### Recommended file structure

```text
app/(app)/accounts/[id]/page.tsx
app/api/accounts/[id]/transactions/route.ts
components/accounts/AccountHeader.tsx
components/accounts/TransactionTable.tsx
lib/ledger-labels.ts
```

### Best practices

- Format money with the same `formatMoney` as 1.3.
- Do not fetch all transactions into the client for a user with long history — paginate.

### Performance optimizations

- Use the compound index.
- Aggregation for `ledgerBalance` can run once per request; do not recompute per row in JS beyond the current page if you skip running balance.

### Security considerations

- 404 for other users' accounts (no 403 that confirms the id exists).
- Do not expose other accounts' transactions via query injection (`account` filter is the path id, not client-supplied).

---

## 6. Dependencies

### Required features or services

- 1.1 Account
- 1.2 Transaction + ledger
- 1.3 Account list UI (navigation into detail)

### External libraries

- `date-fns` or `dayjs` for formatting dates (listed in TOOLS_AND_TECH for Phases 1–2)

### Prerequisites

- At least one account with an opening balance to demo history.

---

## 7. Acceptance Criteria

- [ ] Opening the account detail as the owner shows name, type, currency, and current balance.
- [ ] Displayed balance **always matches** the sum of that account's transactions (credits − debits).
- [ ] Every ledger row for that account appears in history (paginated if many).
- [ ] Another user (or logged-out user) cannot view the page or API (404 / 401 / login redirect).
- [ ] Empty history and negative balances render correctly.
- [ ] Clicking an account on `/accounts` navigates to this page.

**Out of scope:** recording expenses/income (Phase 2), editing ledger rows, CSV export (future).
