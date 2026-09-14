# FinVault — Project Documentation

## 1. Overview

FinVault is a personal + group finance management system. It gives every user
a real personal ledger (bank/cash accounts, income, expenses) and layers a
group expense/settlement system on top of it, so that money shared with
friends, roommates, or trip groups is reflected in the same real account
balances a user manages individually — not a separate, disconnected number.

**Core idea:** a user's `Account` balance is the single source of truth for
their money. Whether the balance changes because of a personal grocery
expense or because they paid for a group dinner, it happens through the same
underlying ledger (`Transaction`). Group logic (who owes whom, splits,
settlements) sits on top of that ledger rather than beside it.

## 2. Problem This Solves

Most expense-splitting apps (Splitwise-style) track "who owes whom" as an
isolated number with no connection to a user's actual money. FinVault removes
that disconnect:

- If you pay for a group dinner, your real account balance drops immediately.
- If someone settles up with you, your real account balance rises immediately.
- Your personal dashboard shows one true picture: what you have, what you
  spent, and what you're owed — all derived from the same ledger.

## 3. User Types

| Type | Description |
|---|---|
| **Registered user** | Has a real FinVault account, can log in, has real `Account`(s) and `Transaction` history. |
| **Guest** | Added to a group by an admin, has no login. Represented by a `GroupMember` record with no linked `User`/`Account`. Balances for guests exist only as bookkeeping on group expenses — there's no real account to debit. |

A guest can later **claim** their profile by signing up with a matching
email. This converts the guest into a registered user while preserving the
same `GroupMember._id`, so history is never duplicated or lost.

## 4. Core Concepts

### 4.1 Accounts are real money
Every registered user can hold multiple `Account`s (bank, cash, wallet, etc.).
Every action that changes how much money a user has — personal expense,
personal income, a group expense they paid for, a settlement transfer —
writes a row to a single `Transaction` ledger tied to an `Account`. This is
documented in full in **Section 6 — Data Models**, and the reasoning behind
this decision (vs. keeping group balances fully separate) is in
**Section 7 — Key Design Decision**.

### 4.2 Groups are bookkeeping on top of real accounts
A `Group` has `GroupMember`s (registered or guest). A `GroupExpense` records
what was spent, who paid, and how it's split. A `GroupTransfer` records
money moving between two members to settle a debt. Both of these reference
real `Account`s (via `GroupMemberAccount`) when the member is registered, so
the "who owes whom" bookkeeping and the "real money" ledger stay in sync.

### 4.3 Splits
Group expenses can be split:
- **Equal** — divided evenly across selected participants.
- **Manual** — payer specifies each participant's exact share; shares must
  sum to the total expense amount.

### 4.4 Settlements
- Between two **registered** users: a `GroupTransfer` is created as
  **Pending**, and only takes effect (debits/credits real accounts) once the
  receiving user **Confirms** it. They can also **Reject** it.
- Any transfer involving a **guest**: **auto-confirmed**, since a guest
  can't log in to confirm anything themselves.

### 4.5 Currency
All amounts are normalized and stored internally in a single base currency
(PKR), with conversion applied only at the display layer when a different
currency is relevant.

## 5. Architecture

- **Frontend + Backend:** Next.js (App Router), API routes serve as the
  backend — no separate Express server.
- **Database:** MongoDB, accessed via Mongoose, running locally during
  development.
- **Auth:** Session/JWT-based authentication protecting all non-public
  routes.
- **Ledger-first design:** `Transaction` is the backbone collection. Balances
  are never stored as a mutable field that's directly edited — they're always
  the result of ledger entries (see Section 7).

## 6. Data Models (Summary)

| Model | Purpose |
|---|---|
| `User` | Registered account holder — auth identity. |
| `Account` | A bank/cash/wallet belonging to a `User`. Holds currency and running balance. |
| `Transaction` | The single ledger — every credit/debit against an `Account`, with a `sourceType`/`sourceId` pointing back to what caused it (`Expense`, `Income`, `GroupExpense`, `GroupTransfer`). |
| `Expense` | A personal expense, tied to an `Account`. Writes a debit `Transaction`. |
| `Income` | Personal income, tied to an `Account`. Writes a credit `Transaction`. |
| `Group` | A named group of members (e.g. "Goa Trip", "Flatmates"). |
| `GroupMember` | Canonical identity within a group — registered user or guest. All expenses/transfers reference this, not `User` directly. |
| `GroupMemberAccount` | Links a `GroupMember`'s real `Account`(s) to a group, so group expenses know which account to debit. |
| `GroupExpense` | A shared expense: amount, payer, split type (Equal/Manual), per-member shares. |
| `GroupTransfer` | A settlement between two members: amount, status (Pending/Confirmed/Rejected/Auto-confirmed). |

## 7. Key Design Decision — Ledger as Single Source of Truth

Early in planning, two approaches were considered for how group money
interacts with personal accounts:

- **Option A (chosen):** Every group expense and confirmed transfer writes a
  real `Transaction` against the relevant `Account`, immediately. Account
  balance is always accurate and current.
- **Option B (rejected):** Group balances live in a separate computed ledger
  and only touch the real account once a settlement is confirmed.

**Option A was chosen** because the product's core requirement is that
group activity is reflected in real account balances *as it happens* — not
only once people settle up. The tradeoff is added complexity around editing
or deleting a group expense (the linked `Transaction` must be found via
`sourceId` and reversed/adjusted, not just recomputed), and a policy decision
to **allow negative balances** rather than blocking group expenses when an
account doesn't have sufficient funds.

## 8. Build Plan

The project is being built in phases, from foundation up to full polish. See
`project_phases.html` for the complete, detailed phase-by-phase feature and
acceptance-criteria breakdown. In short:

0. Foundation (Next.js, MongoDB, Auth)
1. Individual Accounts
2. Individual Income & Expenses
3. Groups (structure only)
4. Linking Accounts to Groups
5. Group Expenses (real money movement)
6. Settlements / Transfers
7. Guest Claim Flow
8. Polish & Reporting

## 9. Open Items / Future Considerations

- Whether to hard-block group expenses on insufficient balance vs. only warn
  (currently: allow negative, warn only).
- Multi-currency support beyond a single base currency + display conversion.
- Recurring personal expenses/income (subscriptions, salary).
- Export/reporting formats (CSV/PDF) for personal and group statements.
