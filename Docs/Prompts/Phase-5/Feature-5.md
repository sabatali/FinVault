# Feature 5.5 — Live Group Balance Calculator (`GET /:id/balances`)

> **Project:** FinVault  
> **Phase:** 5 — Group Expenses (Money Moves for Real)  
> **Feature ID:** 5.5  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth

## Context for the Implementer

Project acceptance: *"Who owes whom" always matches manual calculation from expense records.*

Balances are **derived**, not stored. Compute from:

1. All `GroupExpense` documents in the group: for each participant, `net += shareAmount` (they owe that much toward the bill). For the payer, `net -= amount` (they are owed the full bill / they already paid). Equivalent: payer paid `amount`, each participant including payer is responsible for `share`. So member net = `sum(paid) - sum(shares)`.

   - `paid` = sum of expense.amount where they are payer.
   - `share` = sum of their shareAmounts.

   **Positive net** = the group owes them (they are in credit). **Negative net** = they owe the group.

2. Phase 6 confirmed/auto-confirmed `GroupTransfer`s will also adjust nets (subtract from sender debt / receiver). **Design the calculator now** to include transfers with status `confirmed` or `auto_confirmed` so Phase 6 does not rewrite it. Pending/rejected transfers **do not** affect balances.

3. Do **not** use `Account.cachedBalance` for "who owes whom". Personal account balance is a different concept.

Endpoint: **`GET /api/groups/:id/balances`** (plan says `GET /:id/balances`).

---

## 1. Feature Overview

### Purpose

Expose a live, reproducible group balance for every `GroupMember` (registered and guest) from expenses (and later confirmed transfers).

### Business objective

Members trust the split; settlements (Phase 6) will use these nets.

### User story

> As a group member, I want to see who is up and who is down based on logged expenses, and I want that to match what I calculate by hand.

---

## 2. Functional Requirements

### Complete feature behavior

1. GET balances for members only.
2. Return per-member: `memberId`, `displayName`, `memberType`, `net`, `paidTotal`, `shareTotal`.
3. Return a simplified `pairSuggestions` optional — **that's 6.4**. Here you may return raw nets only.
4. UI: "Balances" section on the group page; positive/negative formatting.
5. Guests appear with nets even though they have no Account.

### Validation

- Membership required.
- Amounts 2 decimal places.

### User interactions

- Refresh by reloading the page or SWR; must be correct immediately after adding an expense (no cache of stale nets — compute on read).

### Edge cases

- No expenses: all nets 0.
- Equal 3000 / 3: payer net +2000, others −1000 each (payer paid 3000, share 1000).
- Manual splits: use stored shareAmounts, not equal math.
- Deleted expenses excluded (they are gone).
- Rounding: nets must sum to **0** (within 0.01). If not, you have a bug in share remainder logic.

---

## 3. Technical Requirements

### Service

`lib/group-balances.ts` — `computeGroupBalances(groupId)`

Algorithm:

```
for each member: paid = 0, share = 0
for each expense:
  paid[payer] += expense.amount
  for each participant: share[member] += shareAmount
for each confirmed transfer:  // Phase 6
  paid-equivalent: sender net += amount? 
  Standard: transfer of X from A to B means A paid X toward settling, so A.net += X, B.net -= X
  (A owed the group, sending money to B who was owed)
net[m] = paid[m] - share[m] + transferAdjustments
```

### API

`GET /api/groups/[id]/balances`

```json
{
  "currency": "PKR",
  "members": [
    { "memberId": "...", "displayName": "Ayesha", "net": 2000, "paidTotal": 3000, "shareTotal": 1000 }
  ],
  "sumOfNets": 0
}
```

### Background jobs

None — live compute.

---

## 4. UI/UX Requirements

### Components

- `GroupBalances.tsx` — list with "Ayesha is owed PKR 2,000" / "Ali owes PKR 1,000"

### States

- **Empty:** "No expenses yet — everyone is settled."
- **Loading:** skeleton
- **Error:** retry

### Responsive / a11y

Don't use color alone for owed vs owes; use words.

---

## 5. Implementation Guidelines

### Steps

1. Implement compute with tests (table-driven cases).
2. Wire GET.
3. Show on group page.
4. After 5.1 fixture, verify by-hand math.

### Performance

- For typical groups (< 50 expenses) load all expenses in memory. If large, aggregate with `$unwind` participants.

### Security

- Members only.

---

## 6. Dependencies

- 5.1–5.2 expenses with participants
- 3.2 members
- Phase 6 transfers: include in the function with a safe empty query

---

## 7. Acceptance Criteria

- [ ] `GET /api/groups/:id/balances` returns nets that match manual calculation from expense records.
- [ ] `sumOfNets` is 0 (within one paisa).
- [ ] UI shows every member including guests.
- [ ] Pending transfers (once 6.1 exists) do not change nets; confirmed ones do.
- [ ] Adding/deleting an expense updates balances on the next GET.

**Out of scope:** minimizing number of settlement payments (6.4); FX (8.2).
