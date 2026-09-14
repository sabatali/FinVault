# Feature 6.3 — Confirmed Transfer Debits Sender and Credits Receiver

> **Project:** FinVault  
> **Phase:** 6 — Settlements / Transfers  
> **Feature ID:** 6.3  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · JWT auth · MongoDB sessions

## Context for the Implementer

Acceptance: *Both accounts' balances update by the exact transfer amount.*

When a transfer becomes `confirmed` (receiver accepted) or `auto_confirmed` with a registered party:

| From | To | Ledger |
|---|---|---|
| Registered | Registered | Debit sender account **and** credit receiver account (two Transactions, same `sourceId`, different `account`) |
| Registered | Guest | Debit sender only |
| Guest | Registered | Credit receiver only |
| Guest | Guest | None |

`sourceType: "group_transfer"` for every row. Unique index is `(sourceType, sourceId, account)` — two rows for two accounts is OK.

**Pending must not call this.** Rejected must not call this.

Amounts always positive; direction via credit/debit.

MongoDB session: status update + ledger posts atomic. Store `debitTransactionId` / `creditTransactionId`.

Negative sender balance: **allowed**, warn on confirm UI if it would go negative.

---

## 1. Feature Overview

### Purpose

Move real money on the ledger when a settlement is confirmed (or auto-confirmed).

### Business objective

If someone settles up with you, your real account balance **rises immediately** (product promise).

### User story

> After I confirm Ali paid me PKR 1000, my account is +1000 and Ali's is −1000, each with a group_transfer ledger line.

---

## 2. Functional Requirements

### Complete feature behavior

1. `applyGroupTransferLedger(transfer, session)` in `lib/ledger.ts` or `lib/group-transfer-ledger.ts`.
2. Call from confirm (6.1) and auto-confirm create (6.2).
3. Idempotent: if transaction ids already set, no-op (safe retries).
4. `toAccount`: on confirm, receiver supplies `toAccountId` (linked, owned). On auto-confirm registered receiver, use primary.
5. Account detail shows two possible rows (different users' accounts).

### Validation

- Accounts belong to the correct users.
- Amount matches transfer.amount on both posts.

### Edge cases

- Receiver has no linked account on confirm: 400, stay pending.
- Unique index conflicts: treat as already posted.
- Confirm after reject: 409.

---

## 3. Technical Requirements

### Transactions

Debit: `{ entryType: "debit", sourceType: "group_transfer", sourceId: transfer._id, account: fromAccount, amount }`  
Credit: `{ entryType: "credit", ... account: toAccount }`

Description: `{group.name} · Settlement`.

### APIs

No standalone public "post ledger" API. Confirm body: `{ "toAccountId": "..." }`.

### Background jobs

None.

---

## 4. UI/UX Requirements

- Confirm modal: pick deposit account, show "Your balance will increase by PKR X".
- Sender warning if their balance would go negative.

### Account history labels

"Group settlement" for `group_transfer`.

---

## 5. Implementation Guidelines

### Steps

1. Implement apply helper with session.
2. Wire confirm + auto-confirm.
3. Tests: 5000 and 8000 start; transfer 1000; end 4000 and 9000; two tx rows; 5.5 nets updated.

### Security

- Only confirm path and auto-confirm create path call apply.
- IDOR on toAccountId.

---

## 6. Dependencies

- 1.2 postLedgerEntry (unique index allows two accounts)
- 6.1 confirm
- 6.2 auto-confirm
- 4.1 linked accounts

---

## 7. Acceptance Criteria

- [ ] Confirmed registered-registered transfer updates **both** accounts by the exact amount (debit sender, credit receiver).
- [ ] Two `Transaction` rows, `sourceType: "group_transfer"`, same `sourceId`.
- [ ] Pending transfers still move no money.
- [ ] Guest-involved cases post only the registered side's row (or none).
- [ ] Operation is atomic (no debit without credit when both required).

**Out of scope:** suggestions (6.4); reversing confirmed transfers (not in plan — omit unless you add admin-only reverse).
