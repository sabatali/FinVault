# Feature 2.4 — Personal Dashboard (Balances & Spend-by-Category)

> **Project:** FinVault  
> **Phase:** 2 — Individual Income & Expenses  
> **Feature ID:** 2.4  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth · Recharts optional in this phase (required in 8.1; a simple CSS bar list is acceptable now)

## Context for the Implementer

Replace the Phase 0 placeholder `/dashboard` with a **personal** finance home: balance **per account** and a **spend-by-category** breakdown. Project acceptance: *Dashboard totals match the sum of underlying accounts.*

This is **not** yet the combined personal + group net-worth dashboard (that is Feature 8.1). You may show a simple "you are owed / you owe" placeholder **only if** group balances exist — **do not** invent group net worth here. Stick to personal accounts + personal expenses/income.

**Source of truth:** account balances from the ledger (`cachedBalance` must match ledger sum; display the same number as Feature 1.4). Category spend is the sum of **personal expenses** in the selected period, grouped by category — **not** group expenses.

**Currency:** display PKR. Conversion is Phase 8.2.

---

## 1. Feature Overview

### Purpose

Give the logged-in user a single home screen: what they have in each account, total personal balance, and where personal spending went by category.

### Business objective

Make FinVault useful daily before groups exist; prove the ledger math in a human-readable summary.

### User story

> As a user, I want to open the dashboard and see each account's balance and a category breakdown of my spending so I know my totals match my real accounts.

---

## 2. Functional Requirements

### Complete feature behavior

1. **Total personal balance** = sum of `cachedBalance` (or ledger sums) of all the user's accounts.
2. **Per-account cards** with name, type, balance; click through to `/accounts/[id]`.
3. **Period selector** for spend breakdown: This month (default), Last 30 days, Last 3 months, All time.
4. **Spend-by-category:** sum of personal `Expense.amount` in period, grouped by category (Uncategorized for null). Show amount and % of period spend.
5. **Period income vs expense totals** (two summary numbers) so the user sees flow, not only stock.
6. If no accounts: empty state CTA to `/accounts/new`.
7. If accounts but no expenses in period: breakdown empty state "No spending in this period."

### Validation rules

- Period query: allowlisted keys only (`this_month`, `last_30`, `last_90`, `all`).
- All figures rounded to 2 decimals; percentages to 1 decimal.

### User interactions

- Dashboard is the default post-login page (`/dashboard`).
- Period control updates the breakdown (query param or client fetch).
- Account cards are links.

### Edge cases

- Negative account and negative total: show clearly.
- User with many categories: show top 8 + "Other" bucket.
- Timezone: "this month" uses local timezone **or** UTC — pick **Asia/Karachi** as default for PKR users, document it, use it consistently in aggregations.
- Zero total spend: don't divide by zero for %.

---

## 3. Technical Requirements

### Architecture considerations

Prefer `GET /api/dashboard/personal?period=this_month` computed on the server with aggregations rather than sending all expenses to the client.

### Database models/tables

Reads `accounts`, `expenses`, `incomes`, `categories`. No new collection.

### APIs and services

**`GET /api/dashboard/personal?period=this_month`**

```json
{
  "currency": "PKR",
  "totalBalance": 50000,
  "accounts": [{ "id": "...", "name": "HBL", "type": "bank", "cachedBalance": 30000 }],
  "period": { "key": "this_month", "from": "...", "to": "..." },
  "incomeTotal": 100000,
  "expenseTotal": 20000,
  "spendByCategory": [
    { "categoryId": "...", "name": "Food", "amount": 8000, "percent": 40 }
  ]
}
```

`totalBalance` **must** equal `sum(accounts.cachedBalance)` (return both so the UI can assert).

### Background jobs or schedulers

None.

---

## 4. UI/UX Requirements

### Pages or components involved

- `app/(app)/dashboard/page.tsx` (replace placeholder)
- `components/dashboard/AccountBalanceCards.tsx`
- `components/dashboard/SpendByCategory.tsx`
- `components/dashboard/PeriodSelect.tsx`
- `components/dashboard/FlowSummary.tsx` (income vs expense)

Charts: horizontal bars or a donut via **recharts** if you add the dependency now; a stacked bar list is enough. Phase 8.1 will add richer charts.

### Loading, empty, success, and error states

- **Loading:** skeleton for cards + chart.
- **Empty accounts:** CTA.
- **Empty spend:** message, still show balances.
- **Error:** retry button.

### Responsive behavior

- Desktop: cards in a row, chart beside or below.
- Mobile: stacked cards, full-width bars.

### Accessibility considerations

- Totals in text, not chart-only.
- Period select labeled.
- Color not the only category encoding (labels required).

---

## 5. Implementation Guidelines

### Step-by-step implementation approach

1. Implement period date helper with a documented timezone.
2. Aggregation pipeline for expenses in range, `$group` by category, `$lookup` names.
3. Sum accounts with `{ owner: userId }`.
4. Build UI; add a debug check in development: `Math.abs(total - sumCards) < 0.001`.
5. Manual test: two accounts 10k+20k, dashboard 30k; add 1k food expense, total 29k, Food 1k.

### Recommended file structure

```text
app/api/dashboard/personal/route.ts
app/(app)/dashboard/page.tsx
lib/period.ts
components/dashboard/
```

### Best practices

- Same `formatMoney` as accounts.
- Do not include group ledger in `expenseTotal`.

### Performance optimizations

- Index `{ user: 1, occurredAt: -1 }` on expenses (2.1).
- One API payload for the page.

### Security considerations

- Auth required; data scoped to `userId`.

---

## 6. Dependencies

### Required features or services

- 1.3 Account list/balances
- 2.1 Expenses
- 2.2 Income (for incomeTotal)
- 2.3 Categories (for names; uncategorized fallback)

### External libraries

- `recharts` optional
- `date-fns-tz` or equivalent if needed for Asia/Karachi

### Prerequisites

- Seeded categories and some sample expenses for a meaningful screenshot.

---

## 7. Acceptance Criteria

- [ ] Dashboard **total matches the sum of underlying account balances**.
- [ ] Each account's dashboard figure matches its account detail/ledger balance.
- [ ] Spend-by-category totals equal the sum of personal expenses in the selected period (including Uncategorized).
- [ ] Period control changes the breakdown, not the account stock balances.
- [ ] Empty and loading states work.
- [ ] Logged-out users cannot access the API or page.

**Out of scope:** group net worth (8.1), FX (8.2), notifications (8.3), CSV export.
