# Feature 1.1 — Account Model (Personal Money Containers)

> **Project:** FinVault  
> **Phase:** 1 — Individual Accounts  
> **Feature ID:** 1.1  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · JWT auth

## Context for the Implementer

FinVault's core idea: a user's **`Account` balance is the single source of truth** for their money. Whether the balance later changes because of a personal grocery expense or because they paid for a group dinner, it happens through the same ledger (`Transaction`, Feature 1.2).

This feature defines the `Account` model and a **create-via-API** path so documents land in MongoDB with the correct owner. Full list/edit/delete UI is Feature 1.3. The transaction ledger is Feature 1.2 — but you must design Account **now** so it never becomes a field people PATCH as "set balance = 5000" without a ledger row.

**Key design rules (project-wide):**

- Every registered user can hold **multiple** accounts (bank, cash, wallet, etc.).
- Currency on the account is stored (default PKR). Internally FinVault normalizes amounts to **base currency PKR** (display conversion is Phase 8).
- **Do not** treat `balance` as a user-editable field. Docs say the Account "holds" a running balance **and** that balances are never directly edited — they are the result of ledger entries.
- **Policy:** negative balances are **allowed** (warn later in UI; never hard-block).
- Guests have **no** `Account`. Only `User`s do.

**Opening balance:** When an account is created with an initial balance, that amount **must** be represented as a ledger entry (Feature 1.2). In this feature, if 1.2 is not implemented yet, either:

- **Preferred if 1.2 lands in the same sprint:** create the account + opening `Transaction` in one MongoDB session, or
- **If 1.2 is strictly later:** store `openingBalance` on the account **and** document that Feature 1.2 will convert it into a `Transaction` with `sourceType: "opening_balance"` on first migration/use. **Do not** ship a production path that sets `cachedBalance` with no transaction once 1.2 exists.

Coordinate with Feature 1.2: the intended end state is `cachedBalance === sum(transactions)` always.

---

## 1. Feature Overview

### Purpose

Introduce the `Account` Mongoose model (name, type, currency, owner, running balance cache) and an authenticated API to create an account owned by the current user.

### Business objective

Give each registered user real money containers (bank / cash / wallet) that later personal expenses, income, group expenses, and settlements will debit and credit.

### User story

> As a registered user, I want to create a named account (for example "HBL Current" or "Cash") so that FinVault can track my real money in that container.

---

## 2. Functional Requirements

### Complete feature behavior

1. Define `Account` schema with validation.
2. `POST /api/accounts` creates an account for `req.user.id` only (owner is **never** taken from the client body).
3. Return the created account JSON.
4. Reject unauthenticated requests (401) via existing `requireAuth`.
5. A user may create multiple accounts, including the same type (two bank accounts are fine); names may repeat but you should still allow it (users often have similarly named accounts) — optional uniqueness of `(owner, name)` is **not** required.

### Validation rules

| Field | Rules |
|---|---|
| `name` | Required, trimmed, 1–80 chars. |
| `type` | Required, enum: `bank` \| `cash` \| `wallet`. |
| `currency` | Optional, default `"PKR"`, 3-letter uppercase code. |
| `openingBalance` | Optional number, default `0`. May be `0`. May be **negative** (allowed). Must be a finite number. Round to 2 decimal places using the shared money helper. |
| `owner` | Set from auth; ignore body.owner. |

### User interactions

API-first in this feature. A minimal create form is **optional**; Feature 1.3 ships the full CRUD UI. If you add a quick form on `/accounts`, keep it compatible with 1.3.

### Edge cases

- Missing name or invalid type → 400 with field errors.
- Extremely large opening balance: cap at a reasonable max (e.g. 1e12) to avoid overflow.
- Floating point: never store `0.1 + 0.2` artifacts — round via `lib/money.ts`.
- User cannot create an account for another user.
- Deleted users: accounts remain until later cleanup; no cascade required here.

---

## 3. Technical Requirements

### Architecture considerations

- Server-only model: `models/Account.ts`.
- Shared money utilities: `lib/money.ts` (`roundAmount`, `toMinorUnits` optional). **Recommendation:** store amounts as **Number rounded to 2 decimal places** for PKR, with all arithmetic going through helpers. Document that Phase 8 conversion is display-only.
- `cachedBalance` is updated **only** by trusted server code (transaction writer in 1.2+), never by a generic `findByIdAndUpdate` from a PATCH of balance in 1.3.

### Database models/tables

**Collection: `accounts`**

```ts
{
  owner: ObjectId;          // ref User, required, indexed
  name: string;
  type: "bank" | "cash" | "wallet";
  currency: string;         // default "PKR"
  cachedBalance: number;    // running balance; default 0; NOT directly editable by clients
  openingBalance: number;   // original opening amount for audit; default 0
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: `{ owner: 1 }`.

**Do not** add a unique index that would block multiple wallets.

### APIs and services

**`POST /api/accounts`** (auth required)

Body:

```json
{
  "name": "HBL Current",
  "type": "bank",
  "currency": "PKR",
  "openingBalance": 15000
}
```

Response 201: the account including `id`, `owner`, `cachedBalance` (equal to opening balance once ledger exists; if 1.2 is already in, this value comes from the opening transaction).

**`GET /api/accounts`** may be stubbed here as list-by-owner (helps testing); Feature 1.3 requires it fully.

### Background jobs or schedulers

None.

---

## 4. UI/UX Requirements

### Pages or components involved

None required beyond what Feature 1.3 will own. If you touch `/accounts`, do not invent a final design that 1.3 must throw away — keep a simple form.

### Loading, empty, success, and error states

API: 201 on success; 400 validation; 401 unauthenticated.

### Responsive behavior

N/A if API-only.

### Accessibility considerations

N/A if API-only. If a form exists, labeled inputs and error text.

---

## 5. Implementation Guidelines

### Step-by-step implementation approach

1. Add `lib/money.ts` with `roundAmount(n: number): number` (half-up to 2 decimals) and `assertFiniteAmount`.
2. Create `models/Account.ts` with enums and defaults.
3. Implement `POST /api/accounts` using `requireAuth` + `connectDB`.
4. If Feature 1.2 already exists, write the opening `Transaction` in a Mongoose session together with the account (see 1.2 for `sourceType: "opening_balance"`). If not, set `cachedBalance = openingBalance` and leave a `TODO(1.2)` comment — Feature 1.2 **must** close this gap.
5. Index `owner`.
6. Manual test via HTTP client: create two accounts, verify `owner` matches the logged-in user in MongoDB Compass.

### Recommended file structure

```text
lib/money.ts
models/Account.ts
app/api/accounts/route.ts          # POST (and GET if included)
```

### Best practices

- Use `new mongoose.Types.ObjectId(userId)` only after validating the session user id.
- Return `id` (string) in JSON, not only `_id`.
- Never accept `cachedBalance` from the client.

### Performance optimizations

- Index on `owner` for list queries in 1.3.

### Security considerations

- Owner from JWT only.
- Mass-assignment: pick fields explicitly (`name`, `type`, `currency`, `openingBalance`).
- Auth on the route (middleware + `requireAuth`).

---

## 6. Dependencies

### Required features or services

- 0.1 MongoDB connection
- 0.2 `User` + `requireAuth`
- 0.3 protected APIs (401 without cookie)

### External libraries

- `mongoose` (existing)
- `zod` for body validation (recommended)

### Prerequisites

- Logged-in test user.

---

## 7. Acceptance Criteria

- [ ] Authenticated `POST /api/accounts` creates a document in `accounts` with `owner` equal to the current user's `_id`.
- [ ] `type` accepts only `bank`, `cash`, `wallet`.
- [ ] Default currency is `PKR` when omitted.
- [ ] Client-supplied `owner` or `cachedBalance` is ignored.
- [ ] Unauthenticated POST returns 401.
- [ ] Invalid payload returns 400 with field-level errors.
- [ ] Multiple accounts per user are allowed.
- [ ] Opening/cached balance is rounded to 2 decimal places.

**Out of scope:** full CRUD UI (1.3), `Transaction` model (1.2) except the opening-balance coordination described above, group member accounts (Phase 4).
