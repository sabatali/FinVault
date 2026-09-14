# Feature 6.4 — Settlement Suggestions (Minimize Number of Transfers)

> **Project:** FinVault  
> **Phase:** 6 — Settlements / Transfers  
> **Feature ID:** 6.4  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth

## Context for the Implementer

Acceptance: *Suggested transfers fully clear all outstanding group balances.*

Input: member `net` from Feature 5.5 (after expenses and **confirmed** transfers). Output: a **minimal number of payments** that bring all nets to 0.

**Algorithm (greedy settle):**

1. Split members into debtors (`net < 0`) with `debt = -net` and creditors (`net > 0`) with `credit = net`.
2. Sort both by amount descending (or use two pointers).
3. Repeatedly pair largest debtor with largest creditor, payment = min(debt, credit), append `{ from, to, amount }`, subtract, drop zeros.
4. This minimizes **nothing theoretically optimal** in all graphs but is the standard "simplify debts" greedy used by Splitwise-style apps and **does fully clear all balances**. A true min-edge settlement is NP-hard; **greedy is required and sufficient** for the acceptance criterion ("fully clear"), not "prove minimum edges". Still: greedy typically yields few transfers. You may sort to prefer fewer obvious pairs.

Do **not** auto-create GroupTransfers. Suggestions are a **proposal**. User (usually a debtor) can click "Record this" to open 6.1/6.2 create with prefilled from/to/amount.

Nets already ~0: return `[]` and UI "Everyone is settled."

Rounding: work in paisa integers; leftover 1 paisa assigned to last pair so all nets clear.

---

## 1. Feature Overview

### Purpose

Show the smallest practical set of payments that would zero the group's outstanding nets, and let users record those settlements.

### Business objective

Avoid a complete graph of IOUs ("everyone pays everyone"); settle in a handful of transfers.

### User story

> As a member, I want FinVault to tell me "Ali pays Ayesha 2000, Bilal pays Ayesha 500" so that after those payments the group is clear.

---

## 2. Functional Requirements

### Complete feature behavior

1. `GET /api/groups/[id]/settlement-suggestions` (members only).
2. Compute from live 5.5 nets.
3. UI list: "Ali → Ayesha · PKR 2,000" + button "Record settlement" (hidden/disabled if current user is not involved **or** allow any member to record guest-side).
4. After recording and confirming, suggestions shrink (live).
5. Verify mathematically: applying all suggestions to nets yields all zeros.

### Validation

- Amounts > 0; skip dust below 0.01.

### User interactions

- Section on group balances card: "Suggested settlements".
- Prefill transfer form.

### Edge cases

- Single debtor multiple creditors: multiple suggestions from that debtor.
- All zero: empty list.
- One member only: empty.
- Guests appear as from/to; recording uses 6.2 auto-confirm.

---

## 3. Technical Requirements

### Service

`lib/settle.ts` — `suggestTransfers(nets: { memberId, net }[])`

Pure function, unit-test heavily.

### API

```json
{
  "suggestions": [
    { "fromMemberId": "...", "toMemberId": "...", "amount": 2000 }
  ]
}
```

### Background jobs

None.

---

## 4. UI/UX Requirements

### Components

- `SettlementSuggestions.tsx`

### States

- **Empty:** "You're all settled up."
- **Loading:** skeleton
- **Error:** retry

### a11y

Each suggestion is a short sentence, not only arrows.

---

## 5. Implementation Guidelines

### Steps

1. Unit tests: 3-person equal dinner example; after suggestions, simulate nets → 0.
2. Wire GET using `computeGroupBalances`.
3. CTA into existing transfer form.
4. Do not persist suggestions.

### Performance

- O(n log n) sort; n = members (tiny).

### Security

- Members only; suggestions are not secrets beyond group membership.

---

## 6. Dependencies

- 5.5 balances
- 6.1–6.2 to record a suggestion

### Libraries

- None (keep algorithm in-house)

---

## 7. Acceptance Criteria

- [ ] Suggested transfers **fully clear** all outstanding group nets (applying them in a simulation zeros every member).
- [ ] Empty when already settled.
- [ ] UI lists suggestions and can start a transfer from one.
- [ ] Guests can appear in suggestions.
- [ ] Suggestions ignore pending transfers (because 5.5 ignores them).

**Out of scope:** automatically executing all suggestions in one click (nice-to-have, not required); crypto/FX.
