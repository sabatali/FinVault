# Feature 8.1 — Combined Dashboard: Personal + Group Net Worth

> **Project:** FinVault  
> **Phase:** 8 — Polish & Reporting  
> **Feature ID:** 8.1  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · Recharts · JWT auth

## Context for the Implementer

Acceptance: *Net worth figure matches sum of all account balances.*

Upgrade the Phase 2 personal dashboard into a **combined** home: personal stock (accounts) plus **group context** (what you're owed / you owe across groups). **Net worth** in FinVault is defined as:

**Sum of all of the user's `Account.cachedBalance` (ledger-backed).**

Group "owed to me" is **not** extra cash sitting in a second wallet — Option A already debited the payer. Do **not** add group nets into net worth (that would double-count). Show group exposure **separately**:

- **Net worth** = Σ account balances (must match).
- **You're owed (groups)** = sum of positive `net` for this user's GroupMembers across groups.
- **You owe (groups)** = sum of absolute negative nets.

These group figures are bookkeeping (who should settle), not a second balance sheet.

TOOLS_AND_TECH: charting library e.g. **recharts**.

---

## 1. Feature Overview

### Purpose

One dashboard for "what I have" (real accounts) and "what's outstanding in groups" without mixing those into a false net-worth number.

### Business objective

Deliver the product promise: one true picture — what you have, what you spent, and what you're owed — derived from the same ledger plus group calculators.

### User story

> As a user, I open the dashboard and see my net worth equal to the sum of my accounts, plus a summary of group IOUs.

---

## 2. Functional Requirements

### Complete feature behavior

1. Hero **Net worth** = sum of accounts (PKR).
2. Keep per-account cards and spend-by-category from 2.4.
3. **Groups snapshot:** list groups with the current user's net in each; link to `/groups/[id]`.
4. Totals you're owed / you owe across groups.
5. Optional small chart: account composition (pie of accounts).
6. Assert `netWorth === sum(account balances)` in the API payload (`accountsSum` field).

### Validation / math

- Round 2 decimals.
- Group nets from `computeGroupBalances` per group (don't invent a second formula).

### User interactions

- Same `/dashboard`.
- Period selector still only affects personal spend, not net worth.

### Edge cases

- No groups: hide IOU section or empty CTA.
- Negative net worth: show it.
- Guest-only history claimed: groups appear.

---

## 3. Technical Requirements

### API

Extend `GET /api/dashboard` (or `/api/dashboard/personal` + `/api/dashboard/groups`):

```json
{
  "netWorth": 50000,
  "accountsSum": 50000,
  "accounts": [...],
  "groupSummary": {
    "owedToYou": 2000,
    "youOwe": 500,
    "groups": [{ "id": "...", "name": "Flatmates", "net": 1500 }]
  },
  "spendByCategory": [...]
}
```

### Background jobs

None.

---

## 4. UI/UX Requirements

### Components

- `NetWorthHero.tsx`
- `GroupExposure.tsx`
- Recharts pie/bar for accounts and categories

### States

- Loading skeletons for hero + groups + charts.
- Empty accounts / empty groups.
- Error retry.

### Responsive / a11y

Hero number also in a `p` text; chart has table alternative or labels.

---

## 5. Implementation Guidelines

### Steps

1. Server aggregator.
2. Replace dashboard page.
3. Manual: 3 accounts totaling 12,345.67 — hero matches to the paisa.

### Performance

- Parallel queries: accounts, expenses agg, group memberships + balances.
- Don't compute balances for groups the user left.

### Security

- Only own accounts and member groups.

---

## 6. Dependencies

- 1.x accounts, 2.4 dashboard, 5.5 balances, recharts

---

## 7. Acceptance Criteria

- [ ] Net worth **matches the sum of all account balances**.
- [ ] Group owed/owe figures match 5.5 per group and do **not** inflate net worth.
- [ ] Personal spend-by-category still matches Phase 2 rules.
- [ ] Empty states for no accounts / no groups.
- [ ] Charts render without blocking the numbers (numbers work if chart fails).

**Out of scope:** CSV/PDF export (future); FX display (8.2) except showing PKR consistently until 8.2 lands.
