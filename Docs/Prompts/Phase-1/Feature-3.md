# Feature 1.3 — Account CRUD API & UI

> **Project:** FinVault  
> **Phase:** 1 — Individual Accounts  
> **Feature ID:** 1.3  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth

## Context for the Implementer

FinVault users hold multiple real accounts (bank, cash, wallet). Feature 1.1 created the model and POST; Feature 1.2 is the ledger. This feature ships **list / create / edit / delete** for accounts in the API **and** the authenticated `/accounts` UI (placeholder from Feature 0.3).

**Hard rules:**

- Owner is always the authenticated user. Never list or mutate another user's accounts.
- **Do not** allow PATCH/PUT of `cachedBalance` or `openingBalance` after creation. Rename and change type/currency (with care) only.
- **Delete policy:** If the account has any `Transaction` rows other than a simple unused empty account, **block delete** with 409, or require a dedicated confirmation that the account has zero transactions. Recommended: **cannot delete if any transactions exist**. User must not orphan ledger rows. Empty accounts (no transactions, or only opening_balance of 0 which should not exist) may be deleted.
  - If the only transaction is `opening_balance`, deleting the account must run a MongoDB session: reverse/delete that ledger row, then delete the account (call `reverseLedgerEntriesForSource` from 1.2).
- Currency changes after transactions exist are dangerous; **disallow currency change** once any transaction exists. Allow it only when the account has zero transactions.

---

## 1. Feature Overview

### Purpose

Let a registered user manage their money containers: see all accounts, create new ones, rename them, and delete unused ones. Changes appear immediately in the UI and MongoDB.

### Business objective

Without account CRUD, users cannot set up the personal ledger that group expenses will later debit.

### User story

> As a registered user, I want to add, rename, and remove my bank/cash/wallet accounts so that FinVault reflects the real places my money lives.

---

## 2. Functional Requirements

### Complete feature behavior

1. **List** — all accounts for the current user, typically newest first or by name.
2. **Create** — same validation as 1.1; opening balance posts a ledger entry (1.2).
3. **Update** — `name` always; `type` always; `currency` only if no transactions.
4. **Delete** — as in the delete policy above.
5. UI on `/accounts`: table/cards of accounts with type badge, currency, **current cachedBalance**, actions.

### Validation rules

Reuse 1.1 field rules. Update body cannot include `cachedBalance`, `owner`, `openingBalance`.

Delete: 409 `{ error: "Account has transactions", code: "ACCOUNT_NOT_EMPTY" }` when disallowed.

### User interactions

- Page `/accounts` in the app shell.
- "Add account" button → modal or `/accounts/new` form: name, type, currency, opening balance.
- Row actions: Edit (inline or `/accounts/[id]/edit`), Delete with confirm dialog naming the account.
- After create/edit/delete, list refreshes without a full manual reload (re-fetch or router.refresh).

### Edge cases

- Delete last account: allowed if empty; user may have zero accounts (dashboard later shows empty state).
- Concurrent delete: 404 if already gone.
- Invalid ObjectId in URL → 400/404.
- Opening balance negative: allowed; show a warning on the form ("Negative opening balance is allowed").

---

## 3. Technical Requirements

### Architecture considerations

REST under `/api/accounts`. Server Components may fetch the list; forms as Client Components.

### Database models/tables

Uses `Account` + `Transaction` + `lib/ledger.ts`. No new collection.

### APIs and services

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/accounts` | List current user's accounts. |
| POST | `/api/accounts` | Create (already in 1.1; complete here). |
| GET | `/api/accounts/[id]` | One account if owned; else 404 (do not leak existence of others). |
| PATCH | `/api/accounts/[id]` | Update allowed fields. |
| DELETE | `/api/accounts/[id]` | Delete per policy. |

JSON list item: `id`, `name`, `type`, `currency`, `cachedBalance`, `createdAt`.

### Background jobs or schedulers

None.

---

## 4. UI/UX Requirements

### Pages or components involved

- `app/(app)/accounts/page.tsx`
- `app/(app)/accounts/new/page.tsx` (or modal)
- `components/accounts/AccountList.tsx`
- `components/accounts/AccountForm.tsx`
- `components/accounts/DeleteAccountDialog.tsx`

Type shown as readable labels: Bank, Cash, Wallet.

### Loading, empty, success, and error states

- **Loading:** skeleton cards/rows matching final layout.
- **Empty:** illustration or copy: "No accounts yet. Add a bank, cash, or wallet to start your ledger." + primary CTA.
- **Success:** toast or inline banner "Account created"; new row visible.
- **Error:** API error message; delete 409 explains they must keep the account because it has history (Phase 1.4 will show that history).

### Responsive behavior

- Desktop: table with columns Name, Type, Currency, Balance, Actions.
- Mobile: cards stacked; balance prominent; actions in a menu.

### Accessibility considerations

- Add button is a real button/link.
- Dialog: focus trap, Escape, labelled title.
- Balance formatted with locale (en-PK or `PKR 1,500.00`) — use a `formatMoney` helper.

---

## 5. Implementation Guidelines

### Step-by-step implementation approach

1. Complete REST handlers with ownership checks (`Account.findOne({ _id, owner: userId })`).
2. Create uses ledger for opening balance inside a session.
3. Delete uses session + reverse opening transaction if needed.
4. Replace the Phase 0 placeholder `/accounts` page with the real UI.
5. Use `formatMoney` in `lib/format.ts`.

### Recommended file structure

```text
app/(app)/accounts/page.tsx
app/(app)/accounts/new/page.tsx
app/api/accounts/route.ts
app/api/accounts/[id]/route.ts
components/accounts/
lib/format.ts
```

### Best practices

- 404 for other users' ids (same as not found).
- Optimistic UI optional; prefer revalidate after mutation.
- Keep types shared (`types/account.ts`).

### Performance optimizations

- List query `{ owner: userId }` uses the 1.1 index.
- Do not populate unnecessary refs.

### Security considerations

- IDOR: always filter by owner.
- No balance field on PATCH.
- Confirm delete in UI; still enforce on server.

---

## 6. Dependencies

### Required features or services

- 0.3 App shell (`/accounts` link)
- 1.1 Account model
- 1.2 Ledger service (opening balance + reverse on delete)

### External libraries

- Existing stack; optional `date-fns` unused here.

### Prerequisites

- Authenticated session.
- MongoDB transactions working if delete reverses ledger rows.

---

## 7. Acceptance Criteria

- [ ] Create / edit / delete are reflected immediately in the UI and in MongoDB.
- [ ] List shows only the current user's accounts.
- [ ] Balance on the list equals `cachedBalance` (and thus the ledger, per 1.2).
- [ ] Cannot PATCH balance or owner.
- [ ] Cannot delete an account that has non-reversible history per the stated policy; empty/opening-only accounts delete cleanly with no orphan transactions.
- [ ] Unauthenticated access to APIs is 401; pages redirect to login.
- [ ] Empty state is shown when the user has zero accounts.
- [ ] Mobile layout is usable.

**Out of scope:** transaction history page (1.4), expenses (Phase 2), linking accounts to groups (Phase 4).
