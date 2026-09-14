# Feature 1.2 — Transaction Ledger Model (Single Source of Truth)

> **Project:** FinVault  
> **Phase:** 1 — Individual Accounts  
> **Feature ID:** 1.2  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · JWT auth

## Context for the Implementer

This is the **backbone of FinVault**. Product docs:

> `Transaction` is the single ledger — every credit/debit against an `Account`, with a `sourceType`/`sourceId` pointing back to what caused it (`Expense`, `Income`, `GroupExpense`, `GroupTransfer`).

> Balances are never stored as a mutable field that's directly edited — they're always the result of ledger entries.

> **Option A (chosen):** Every group expense and confirmed transfer writes a real `Transaction` against the relevant `Account`, immediately.

**Implications you must encode now:**

- Every balance change writes **exactly one** `Transaction` row per account affected (a later group transfer that moves money between two registered users will write **two** rows — one debit, one credit — each against a different account; that is Phase 6).
- `Account.cachedBalance` is a cache maintained **only** by the ledger writer.
- Displayed balance on any future page **must** match `sum(credits) - sum(debits)` for that account.
- Editing/deleting sources later (Phase 2 expenses, Phase 5 group expenses) finds the row via `sourceType` + `sourceId` and reverses/adjusts it — never "recompute from scratch while leaving old rows".
- Negative balances **are allowed**.
- All amounts stored in **PKR base** (conversion is display-layer, Phase 8).

Feature 1.1 added `Account`. This feature adds `Transaction` plus a **single server-side service** that all later features **must** call. Do not let Expense/Income/GroupExpense handlers increment `cachedBalance` themselves.

---

## 1. Feature Overview

### Purpose

Create the `Transaction` model and a transactional `ledger` service that appends a credit or debit, updates `Account.cachedBalance` atomically, and links the row to its domain source.

### Business objective

Guarantee that "what I have" in FinVault is always explainable as a list of ledger entries — personal or group — with no disconnected Splitwise-style shadow numbers.

### User story

> As a user, every change to my account balance is an auditable ledger line I can later see on the account detail page (Feature 1.4).  
> As a developer, I have one function to post money so I cannot forget to write a Transaction.

---

## 2. Functional Requirements

### Complete feature behavior

1. Define `Transaction` schema.
2. Implement `postLedgerEntry` (name may vary) that:
   - Loads the account, verifies it belongs to the expected owner when provided.
   - Inserts one Transaction.
   - Updates `cachedBalance` (`credit` adds, `debit` subtracts).
   - Runs inside a **MongoDB session** (transaction) when a session is passed in, so later multi-document flows can share it.
3. Implement `sumBalance(accountId)` that aggregates transactions (source of truth) for assertions and Feature 1.4.
4. When an Account is created with `openingBalance !== 0` (and any remaining 1.1 accounts that only set cache), write `sourceType: "opening_balance"`, `sourceId: account._id`, type credit if positive, debit if negative.
5. **Do not** expose a public "create arbitrary transaction" API for clients. Ledger posts are internal. Optional: `GET /api/accounts/:id/transactions` can wait for Feature 1.4; a protected internal/dev-only GET is acceptable for testing.

### Validation rules

| Field | Rules |
|---|---|
| `account` | Required, must exist. |
| `user` | Required, account owner (denormalized for queries). |
| `entryType` | `credit` \| `debit` (do not use the name `type` if it collides; `direction` or `entryType` is fine). |
| `amount` | Required, **strictly > 0** after rounding to 2 decimals. Sign is expressed by credit/debit, not negative amount. |
| `currency` | Default `PKR`. |
| `sourceType` | Enum: `opening_balance` \| `expense` \| `income` \| `group_expense` \| `group_transfer` \| `adjustment`. |
| `sourceId` | Required ObjectId (for opening balance, the Account id). |
| `description` | Optional, max 200 chars. |
| `occurredAt` | Date of the economic event; default now. |

A unique index on `{ sourceType, sourceId, account }` is **not** always valid (a group transfer might theoretically need two rows with different accounts; same sourceId + different accounts is fine). For **expense/income/group_expense** there should be **exactly one** transaction per source. Enforce uniqueness where it helps:

- Unique compound index: `{ sourceType: 1, sourceId: 1, account: 1 }` so double-posts fail.

### User interactions

None required (no dedicated UI). Account detail UI is 1.4.

### Edge cases

- Amount `0` or negative → reject.
- Missing account → 404 from the service (throw a typed error).
- Double post of the same source+account → duplicate key error; caller should not retry blindly.
- Concurrent posts to the same account: MongoDB transaction + updating the account document should serialize; use session and read the account inside the transaction.
- Do not delete transactions from a public API. Reversal later = compensating transaction **or** deleting the row **and** reversing cache in the same session (Phase 5.4 will pick reverse-or-delete; **implement `reverseLedgerEntry` now** as: find by source, subtract its effect from cache, delete the row — so 5.4 can call it).

---

## 3. Technical Requirements

### Architecture considerations

- `models/Transaction.ts`
- `lib/ledger.ts` — the **only** module allowed to mutate `cachedBalance`.
- Callers in later phases always pass `sourceType` and `sourceId`.

### Database models/tables

**Collection: `transactions`**

```ts
{
  account: ObjectId;       // ref Account, indexed
  user: ObjectId;          // ref User, indexed
  entryType: "credit" | "debit";
  amount: number;          // always > 0, 2 decimal places, PKR
  currency: string;
  sourceType: "opening_balance" | "expense" | "income" | "group_expense" | "group_transfer" | "adjustment";
  sourceId: ObjectId;
  description: string;
  occurredAt: Date;
  createdAt: Date;
}
```

Indexes:

- `{ account: 1, occurredAt: -1 }`
- `{ user: 1, occurredAt: -1 }`
- unique `{ sourceType: 1, sourceId: 1, account: 1 }`

### APIs and services

Internal:

```ts
postLedgerEntry({
  accountId, userId, entryType, amount, sourceType, sourceId, description, occurredAt, session?
}) => Transaction

reverseLedgerEntriesForSource({ sourceType, sourceId, session? }) => void
  // finds all transactions for that source, reverses cachedBalance, deletes them

assertAccountBalanceMatchesLedger(accountId) => void
```

No public POST `/api/transactions`.

### Background jobs or schedulers

None. (A nightly balance-audit job is Phase 8.4, not now.)

---

## 4. UI/UX Requirements

None for this feature. Ledger lines will render on Feature 1.4.

If you add a temporary debug dump, do not ship it in the nav.

---

## 5. Implementation Guidelines

### Step-by-step implementation approach

1. Create the Transaction schema and indexes.
2. Implement `postLedgerEntry` with `session.startTransaction()` when no session is provided (self-contained single entry) **or** join the caller's session.
3. Update Account: for debit, `cachedBalance = round(cachedBalance - amount)`; credit adds.
4. Wire Account creation (1.1) to post `opening_balance` when `openingBalance !== 0` (and when `=== 0`, skip the row — zero-amount transactions are forbidden).
5. Write a small script or API test: create account with opening 1000, assert one transaction, `cachedBalance === 1000`, aggregate match.
6. Export helpers; do not duplicate balance math elsewhere.

### Recommended file structure

```text
models/Transaction.ts
lib/ledger.ts
lib/money.ts                 # from 1.1
```

### Best practices

- Amounts always positive; direction in `entryType`.
- `sourceType` values must stay stable — Phase 5 tags `group_expense` exactly.
- Use Mongoose transactions; local MongoDB must be a **replica set** for transactions. If standalone Mongo rejects sessions, document in README that dev Mongo must be started as a single-node replica set (`rs.initiate()`). This is required for Phases 5–6 anyway.

### Performance optimizations

- Indexes above.
- `cachedBalance` avoids summing the full history on every dashboard load; Feature 1.4 still **verifies** display against sum (or displays sum — either is correct if they match).

### Security considerations

- No client-facing POST.
- Always check account ownership in the service when `userId` is passed.
- Do not allow `adjustment` from user-facing APIs in later phases without an admin flag (there is no admin role yet — **do not expose adjustment** in UI).

---

## 6. Dependencies

### Required features or services

- 0.1–0.2 auth + DB
- 1.1 Account model

### External libraries

- `mongoose` (sessions/transactions)

### Prerequisites

- Local MongoDB replica set **or** a documented fallback: if transactions are unavailable in dev, still update both documents sequentially and log a warning — **prefer fixing Mongo as replica set**.

---

## 7. Acceptance Criteria

- [ ] `Transaction` collection exists with the fields and enums above.
- [ ] Creating an account with a non-zero opening balance writes **exactly one** Transaction and `cachedBalance` equals that amount.
- [ ] Creating an account with opening `0` writes **no** transaction and balance `0`.
- [ ] `postLedgerEntry` rejects amount `<= 0`.
- [ ] A credit increases `cachedBalance` by the exact amount; a debit decreases it by the exact amount (negative cache allowed).
- [ ] `sum` of account transactions (credits − debits) **always** equals `cachedBalance` after each post.
- [ ] There is no public API that lets a client mint arbitrary ledger rows.
- [ ] Unique index prevents two transactions for the same `(sourceType, sourceId, account)`.

**Out of scope:** expense/income models (Phase 2), group sources (Phase 5–6), account detail UI (1.4).
