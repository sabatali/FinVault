# Feature 8.4 — Edge-Case Hardening & Cross-Phase Test Pass

> **Project:** FinVault  
> **Phase:** 8 — Polish & Reporting  
> **Feature ID:** 8.4  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · JWT auth · test runner (Playwright and/or Vitest)

## Context for the Implementer

Acceptance: *No orphaned transactions, no balance drift after stress-testing edits/deletes.*

This feature is **quality work**, not a new money concept. You add an automated safety net around the ledger-first design:

- Every `Transaction` has a living source **or** an allowed source type without a parent (`opening_balance` sources the Account).
- `Account.cachedBalance === ledger sum` for every account.
- Group expense delete/edit (5.4) and transfers (6.x) never leave stray `group_expense` / `group_transfer` rows.
- Unique indexes hold under concurrent posts.
- Negative balances remain allowed; insufficient funds never hard-blocks.

Open items from project docs you should **encode as tests**, not change product policy unless asked:

- Warn-only on insufficient funds (not hard-block).
- Single base currency + display conversion (8.2) without double-conversion.
- Guest claim preserves `GroupMember._id`.

---

## 1. Feature Overview

### Purpose

Harden FinVault so money math survives messy real usage: rapid edits, deletes, guest claim, pending vs confirmed transfers, and concurrent requests.

### Business objective

Users will not tolerate a ledger that drifts. This phase is the release gate.

### User story

> As a developer/release owner, I can run a test pass that proves accounts never drift and no transaction is orphaned after typical and hostile edit/delete sequences.

---

## 2. Functional Requirements

### Complete feature behavior

1. **Balance audit helper** `assertNoBalanceDrift()` used in tests (and optional `GET /api/admin/audit` **dev-only**, disabled in production).
2. **Orphan check:** every transaction's `sourceId` exists in the collection implied by `sourceType`, except `opening_balance` → Account still exists.
3. **Test suites:**

   | Area | Cases |
   |---|---|
   | Ledger | credit/debit, reverse, unique source |
   | Personal expense/income | create/edit/delete restores balance |
   | Group equal/manual | shares sum, full debit, remainder |
   | Group edit/delete | pre-expense balance restored |
   | Transfers | pending no-op; confirm both sides; guest auto-confirm |
   | Suggestions | applying suggestions zeros nets |
   | Claim | member id stable, no duplicate member |
   | FX | no double conversion |
   | Authz | IDOR on accounts, groups, notifications |

4. **Concurrency:** two parallel expense creates against the same account; both transactions exist; final cache = start − a − b.
5. Fix any bugs found; do not weaken assertions.

### User interactions

None for end users except fewer bugs. Optional hidden dev audit page.

### Edge cases (must include)

- Delete group expense after account went negative.
- Edit expense payer from registered to guest.
- Reject transfer then create another.
- Claim guest who is payer on old expenses.
- Delete opening-only account (1.3 policy).
- Manual split off by 0.01 rejected.

---

## 3. Technical Requirements

### Tests

- **Vitest** (or Jest) for `lib/ledger.ts`, `lib/splits.ts`, `lib/settle.ts`, `lib/fx.ts`, `lib/group-balances.ts`, `lib/claim.ts`.
- **API/integration** tests with mongodb-memory-server **or** a dedicated `finvault_test` DB.
- Optional Playwright for login + create expense + dashboard total.

### Audit script

`npm run audit:ledger` — iterates accounts, prints mismatches, exit 1 on drift.

### Background jobs

Optional cron later; not required. Script is enough.

---

## 4. UI/UX Requirements

N/A except if you add a production "Something's wrong with this account" banner when drift is detected — **dev-only recommended** so users don't see scary finance errors from a false positive. Production: log and keep showing ledger sum (1.4 policy).

---

## 5. Implementation Guidelines

### Steps

1. Add test runner + memory mongo.
2. Write unit tests for money helpers first.
3. Integration: user → account → expense → group → transfer → claim.
4. `audit:ledger` script.
5. Fix drift bugs (typical: forgetting reverse on edit, updating cache twice, unique index retry double-apply).
6. Document how to run tests in README.

### Performance

Audit is O(transactions); fine for local.

### Security

- No production admin audit route without auth + env flag.
- Tests use fake users, no real SMTP (mock `sendMail`).

---

## 6. Dependencies

- Entire product through 8.3
- `vitest`, `mongodb-memory-server` (recommended), optionally `@playwright/test`

### Prerequisites

- Replica set still required if tests use transactions.

---

## 7. Acceptance Criteria

- [ ] Automated tests cover create/edit/delete of personal and group expenses and settlements.
- [ ] After the stress scenarios, **no orphaned transactions**.
- [ ] After the stress scenarios, **no balance drift** (`cachedBalance` = ledger sum for every account).
- [ ] Group nets still sum to ~0.
- [ ] Guest claim tests prove stable `GroupMember._id`.
- [ ] Pending transfers do not move ledger money; confirmed/auto-confirmed do.
- [ ] `npm test` (or documented command) is green locally.
- [ ] Insufficient-fund path still **allows** negative balances.

**Out of scope:** new product features, CSV/PDF export, recurring transactions, hard-blocking on insufficient funds.
