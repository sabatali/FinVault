# Feature 6.1 — GroupTransfer: Pending → Confirm / Reject (Two Registered Users)

> **Project:** FinVault  
> **Phase:** 6 — Settlements / Transfers  
> **Feature ID:** 6.1  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth

## Context for the Implementer

Settlements between two **registered** users: a `GroupTransfer` is created as **Pending**, and only takes effect (debits/credits real accounts) once the **receiving** user **Confirms**. They can also **Reject**.

Acceptance: *Transfer stays pending until receiver confirms; balances unaffected until then.*

**Personal account balances** (ledger) stay unchanged while pending. **Group nets** (5.5) also ignore pending (already specified).

The **sender** is the person paying money to settle a debt (typically the one with negative net). The **receiver** confirms they got the money (cash/bank in real life). Sender selects their linked account to debit; receiver will select/confirm their account to credit on confirm — or both accounts are chosen at request time. **Recommended:** sender picks `fromAccount` at create; receiver's `toAccount` is their **primary** at confirm time (or they pick on the confirm screen).

Guest auto-confirm is Feature 6.2. Ledger posting is Feature 6.3 — **do not post ledger in this feature** for the registered-registered path.

---

## 1. Feature Overview

### Purpose

Let a registered member request a settlement to another registered member, which waits in `pending` until the receiver confirms or rejects.

### Business objective

Prevent fake "I paid you" claims from moving real FinVault balances without the receiver's OK.

### User story

> As Ali, I mark that I paid Ayesha PKR 1000 in our group. Ayesha must confirm before my account is debited and hers credited. Until then, nothing in our real balances changes.

---

## 2. Functional Requirements

### Complete feature behavior

1. `GroupTransfer` model with status enum: `pending` | `confirmed` | `rejected` | `auto_confirmed`.
2. **Create (pending):** sender = current user's GroupMember; receiver = another **registered** member; amount `> 0`; `fromAccount` owned and linked; status `pending`.
3. **Confirm:** only the **receiver's** User; status `pending` → `confirmed`; then 6.3 posts ledger (call the helper if it exists).
4. **Reject:** only receiver; `pending` → `rejected`; no ledger.
5. **Cancel:** optional, sender can cancel while pending (status `rejected` or `cancelled` — stick to **rejected** or add `cancelled`; **recommended add `cancelled`** if you want clarity, but plan only lists Pending/Confirmed/Rejected/Auto-confirmed — **use rejected** with `closedBy: sender` **or** only allow receiver reject. Simpler: **sender DELETE pending** = cancel, no status needed. Implement **sender cancel** as DELETE while pending.
6. UI: request settlement form; list pending in/out; confirm/reject buttons for incoming.

### Validation

- Both members in same group, both registered.
- Amount > 0.
- Cannot transfer to self.
- Duplicate pending between same pair: allow multiple (partial payments) **or** block — **allow multiple**.

### User interactions

- "Settle up" from balances: prefill receiver and amount = min of what you owe them if 6.4 exists; otherwise manual amount.
- Incoming pending: banner on group page.

### Edge cases

- Receiver tries to confirm twice: 409 already closed.
- Sender confirms: 403.
- Non-member: 404.
- Amount larger than "debt": **allowed** (overpay); do not hard-block.

---

## 3. Technical Requirements

### Database

**Collection: `grouptransfers`**

```ts
{
  group: ObjectId;
  fromMember: ObjectId;
  toMember: ObjectId;
  fromAccount: ObjectId | null;
  toAccount: ObjectId | null;
  amount: number;
  currency: string;
  status: "pending" | "confirmed" | "rejected" | "auto_confirmed";
  debitTransactionId: ObjectId | null;
  creditTransactionId: ObjectId | null;
  createdBy: ObjectId;
  resolvedBy: ObjectId | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: `{ group: 1, status: 1 }`, `{ toMember: 1, status: 1 }`.

### APIs

| Method | Path | Behavior |
|---|---|---|
| POST | `/api/groups/[id]/transfers` | Create pending (registered-registered). |
| GET | `/api/groups/[id]/transfers` | List (members). |
| POST | `/api/groups/[id]/transfers/[tid]/confirm` | Receiver |
| POST | `/api/groups/[id]/transfers/[tid]/reject` | Receiver |
| DELETE | `/api/groups/[id]/transfers/[tid]` | Sender cancel if pending |

### Background jobs

None. Notify 8.3.

---

## 4. UI/UX Requirements

### Components

- `SettlementForm.tsx`
- `TransferList.tsx` with status badges
- Confirm/Reject on incoming pending

### States

- **Pending:** "Waiting for Ayesha to confirm" — balances unchanged message.
- **Empty:** "No settlements yet."
- **Error:** 403, validation.

### Responsive / a11y

Buttons labeled "Confirm receipt of PKR 1,000 from Ali".

---

## 5. Implementation Guidelines

### Steps

1. Model + create pending (no ledger).
2. Confirm/reject with authorization.
3. Hook 6.3 on confirm (stub empty if 6.3 not done — **must not** change cachedBalance until 6.3).
4. UI.

### Security

- Receiver-only confirm/reject.
- Amounts via server.

---

## 6. Dependencies

- 3.2 members, 4.1 accounts
- 5.5 should ignore pending (verify)
- 6.3 for money movement on confirm

---

## 7. Acceptance Criteria

- [ ] Transfer stays `pending` until the receiver confirms or rejects.
- [ ] While pending, **neither** personal account balances **nor** group nets change.
- [ ] Receiver can confirm or reject; sender cannot confirm.
- [ ] Sender can cancel a pending transfer.
- [ ] Two registered users required on this path (guests → 6.2).

**Out of scope:** auto-confirm guests (6.2), ledger post (6.3), minimize transfers (6.4).
