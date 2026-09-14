# Feature 5.1 — GroupExpense: Equal Split

> **Project:** FinVault  
> **Phase:** 5 — Group Expenses (Money Moves for Real)  
> **Feature ID:** 5.1  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth · MongoDB sessions

## Context for the Implementer

**This is where FinVault diverges from Splitwise.** Paying for a group dinner **drops the payer's real account balance immediately** (Option A). Group split math is bookkeeping **on top of** that ledger.

This feature implements `GroupExpense` with **Equal** split only. Manual split is 5.2. The actual `Transaction` write is specified in 5.3 — **implement the debit in this feature if 5.3 is the next file in the same sprint; otherwise create the GroupExpense and call `postLedgerEntry` here anyway** because an expense without a debit violates the product. **Treat 5.1 + 5.3 as one atomic product behavior.** 5.3 documents tagging `group_expense` in detail; you must still debit here.

**Equal split:** amount divided evenly across **selected participants**. Remainder from rounding (e.g. 100 / 3) must be assigned so **shares sum to the total** (give leftover paisa to the payer or the last participant — pick **largest remainder method**, document it).

**Payer:** a `GroupMember` (usually the current user). Payer account: primary from 4.2 or explicitly selected linked account. **If the payer is a guest, there is no real account to debit** — still record the GroupExpense and shares; skip `postLedgerEntry`.

**Negative balances:** allow; **warn** if payer account would go negative.

Participants must be members of the group. Payer is typically included in the split (can pay and still owe a share).

---

## 1. Feature Overview

### Purpose

Record a shared group expense split equally among selected members, debiting the registered payer's real account for the **full** amount.

### Business objective

Shared costs hit real money as they happen, while "who owes whom" is derived from shares (Feature 5.5).

### User story

> As a group member, I want to add a dinner of PKR 3000 split equally among 3 people so my account is debited 3000 and each share is 1000.

---

## 2. Functional Requirements

### Complete feature behavior

1. `GroupExpense` model with `splitType: "equal"`.
2. Create API + UI on `/groups/[id]/expenses/new`.
3. Compute `shareAmount` per participant: `roundAmount(total / n)` with remainder distributed so sum === total.
4. Debit payer's linked account for **full total** (not their share) via ledger `sourceType: "group_expense"`.
5. List expenses on the group page.
6. Only registered members with a linked account (or explicit account id) can be payers who move real money; guests as payers: bookkeeping only.

### Validation rules

| Field | Rules |
|---|---|
| `amount` | `> 0`, 2 decimals |
| `participantMemberIds` | At least 1, all in group, unique |
| `payerMemberId` | In group |
| `payerAccountId` | Required if payer is registered; must be a GroupMemberAccount for that member |
| `description` | Required, 1–200 chars |
| `occurredAt` | Date, not > 1 day future |

### User interactions

- Form: description, amount, date, payer (default current member), account (default primary), checklist of members (default all selected), split type Equal (selected).
- Warning banner if balance would go negative.
- Submit → expense appears in group feed; payer account detail shows debit.

### Edge cases

- 1 participant: share = total; still a group expense (valid).
- 0 participants: 400.
- Uneven division: 100.00 / 3 = 33.34, 33.33, 33.33 or 33.33×2 + 33.34 — sum 100.00.
- Current user not the payer: allowed if the API is used by the payer **or** any member logging "Ali paid" — **policy: any registered member of the group may record an expense**, including on behalf of another member. Debit **that payer's** account (the other member's linked account), not the logger's. This is sensitive: confirm in UI "This will debit Ayesha's HBL account."
- Insufficient funds: **do not block**.

---

## 3. Technical Requirements

### Database

**Collection: `groupexpenses`**

```ts
{
  group: ObjectId;
  description: string;
  amount: number;
  currency: string; // PKR
  splitType: "equal" | "manual";
  payerMember: ObjectId;
  payerAccount: ObjectId | null;
  participants: [{ member: ObjectId, shareAmount: number }];
  occurredAt: Date;
  createdBy: ObjectId; // User who logged it
  transactionId: ObjectId | null; // null if guest payer
  createdAt: Date;
  updatedAt: Date;
}
```

Index `{ group: 1, occurredAt: -1 }`.

### APIs

`POST /api/groups/[id]/expenses` `{ splitType: "equal", ... }`  
`GET /api/groups/[id]/expenses`

Use a MongoDB **session**: insert expense + `postLedgerEntry` debit full amount.

### Services

`lib/splits.ts` — `equalShares(total, memberIds): { memberId, shareAmount }[]`

### Background jobs

None. Email notify is 8.3; optional hook.

---

## 4. UI/UX Requirements

### Pages

- Group detail expenses list
- `ExpenseForm` with equal split
- Confirm dialog when debiting someone else's account

### States

- **Empty:** "No group expenses yet."
- **Loading / success / error:** standard
- **Validation:** live preview of per-person share

### Responsive / a11y

Member checklist keyboard accessible; share preview as text not only color.

---

## 5. Implementation Guidelines

### Steps

1. Schema + `equalShares` with remainder distribution.
2. POST with access `assertGroupMember`.
3. Ledger debit full amount, `sourceId: expense._id`.
4. UI + preview "PKR 1,000 each".
5. Verify Compass: 1 transaction, cachedBalance − total.

### Performance / security

- Session atomicity.
- IDOR on group id.
- Do not accept client-computed shares for equal (server recomputes).

---

## 6. Dependencies

- 3.x groups/members
- 4.1–4.2 linked + primary account
- 1.2 ledger

### Libraries

- mongoose sessions

---

## 7. Acceptance Criteria

- [ ] Payer's account is debited the **full** expense amount.
- [ ] Each selected member's share is computed correctly (equal, remainder-safe, sum = total).
- [ ] Guest payer does not create a Transaction.
- [ ] Registered payer creates exactly one Transaction (see 5.3).
- [ ] Negative resulting balance allowed with warning.
- [ ] Non-members cannot create expenses.

**Out of scope:** manual split (5.2), edit/delete reverse (5.4), balances API (5.5) except you may display shares on the expense row.
