# Feature 8.2 — Currency Conversion (Display Layer, PKR Base)

> **Project:** FinVault  
> **Phase:** 8 — Polish & Reporting  
> **Feature ID:** 8.2  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth

## Context for the Implementer

Project: *All amounts are normalized and stored internally in a single base currency (**PKR**), with conversion applied **only at the display layer** when a different currency is relevant.*

Acceptance: *All displayed totals convert correctly, **no double-conversion**.*

**Never** convert when writing `Transaction`, `Expense`, `Income`, `GroupExpense`, or `GroupTransfer` amounts. Those stay PKR numbers.

User.`preferredCurrency` (0.2) drives display (e.g. USD). Conversion uses a **single** function `fromBasePKR(amountPkr, targetCurrency, rateTable)` applied once at the edge (API serializer or React `formatMoney`).

Rates: for local/dev, `lib/fx.ts` with a config table (`FX_USD_PKR` env, etc.) and date-agnostic **spot** rates. Do not fetch live rates unless you add a documented provider; a static table is enough. If you fetch, cache and still convert **only in display**.

**Anti-double-conversion checklist:**

- DB amount 1000 PKR → show USD with `1000 / pkrPerUsd` once.
- Do not store USD on the document and also multiply.
- Account.currency field may stay `PKR` for storage; display symbol follows preferredCurrency.
- Aggregations (dashboard, balances) run in PKR then convert the **totals** once.

---

## 1. Feature Overview

### Purpose

Show FinVault figures in the user's preferred currency while keeping PKR as the ledger unit.

### Business objective

Users who think in USD still see consistent totals without corrupting the ledger.

### User story

> I set display currency to USD and every dashboard, account, and group total converts from PKR once — my ledger in Compass is still PKR.

---

## 2. Functional Requirements

### Complete feature behavior

1. Settings: change `preferredCurrency` (`PKR` | `USD` | at least one more, e.g. `EUR`).
2. `formatMoney(pkrAmount, { currency, rates })` used everywhere UI shows money.
3. APIs may return `{ amountPkr, amountDisplay, displayCurrency, rateUsed }` **or** only PKR and let the client convert with `GET /api/fx` rates. **Pick one path and stick to it.** Recommended: **client converts** using `/api/fx` + preferredCurrency from `/api/auth/me` so APIs stay PKR (harder to double-convert).
4. Group and personal screens all use the helper.
5. Input forms: users enter amounts in **display currency**; **convert to PKR on submit** once (`toBasePKR`). If you do this, label the field "Amount (USD)" and never convert again on save.

**Safer MVP:** keep **input in PKR** always; only **outputs** convert. Document that. **Recommended for no double-conversion bugs: inputs remain PKR, display converts.** If you support input in USD, add tests that 10 USD stores the correct PKR paisa.

### Validation

- Unknown currency code → fall back PKR.
- Rate missing → show PKR and warning.

### User interactions

- `/settings` currency select; dashboard updates after save.

### Edge cases

- Rate 0 forbidden.
- Switching currency does not rewrite history documents.
- Equal split remainder still in PKR then display.

---

## 3. Technical Requirements

### FX module

```ts
const BASE = "PKR";
toDisplay(amountPkr, target): number
toBase(amountDisplay, from): number  // only if inputs convert
```

Rates as `PKR per 1 unit of foreign` e.g. USD: 278.50 meaning 1 USD = 278.50 PKR.

### APIs

- `PATCH /api/users/me` `{ preferredCurrency }`
- `GET /api/fx` `{ base: "PKR", rates: { USD: 278.5, EUR: 300 }, asOf }`

### Models

User.preferredCurrency already exists.

### Background jobs

None (no live ticker required).

---

## 4. UI/UX Requirements

- Show currency code next to amounts (`USD 36.00`).
- Settings page.
- Optional small note "Stored as PKR; shown in USD @ 278.5"

### States

- FX API fail: PKR fallback banner.
- Loading rates: show PKR or skeleton amounts.

### a11y

Currency in the text, not symbol-only if ambiguous.

---

## 5. Implementation Guidelines

### Steps

1. `lib/fx.ts` + tests (1000 PKR → expected USD).
2. Replace raw `formatMoney` to take PKR + display currency.
3. Settings.
4. Grep for ad-hoc `cachedBalance` rendering and route through formatter.
5. Test: dashboard total in USD equals `sum(accounts)/rate` not `sum(alreadyConverted)`.

### Security

- Rates from server, not user-supplied multipliers on each amount.

---

## 6. Dependencies

- All UI surfaces that show money
- User.preferredCurrency (0.2)

### Libraries

- None required (no forex SDK)

---

## 7. Acceptance Criteria

- [ ] Displayed totals convert correctly from PKR.
- [ ] **No double-conversion** (spot-check: one account 27850 PKR ≈ 100 USD at rate 278.5, not 0.36 USD).
- [ ] Ledger documents in Mongo remain PKR.
- [ ] Changing preferred currency changes display only.
- [ ] FX failure falls back to PKR without crashing.

**Out of scope:** per-account native currency ledgers; historical rate-by-date; crypto.
