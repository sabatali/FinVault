# FinVault — Tools & Tech Stack

## 1. Core Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js** (App Router) | Single codebase for frontend + backend via API routes/route handlers — no separate Express server needed. |
| Language | **JavaScript / TypeScript** | TypeScript recommended for the data-model-heavy backend (accounts, transactions, splits) to catch shape errors early. |
| Database | **MongoDB** | Running **locally** for development. Document model fits the varied shapes of `Expense`, `Income`, `GroupExpense` splits well. |
| ODM | **Mongoose** | Schema definitions, validation, and query building over MongoDB. |
| Auth | **JWT or session-based (e.g. NextAuth / custom)** | Protects all account, expense, and group routes. Decision on JWT vs. NextAuth to be finalized at Phase 0. |
| Styling | **Tailwind CSS** (recommended) | Fast to build consistent UI across many CRUD-style screens (accounts, expenses, groups). |
| Email | **Nodemailer / a transactional email service** (e.g. Resend, SendGrid) | Needed for guest invites and notification triggers (expense added, settlement requested). |

## 2. Why This Stack

- **Next.js over separate frontend/backend:** the whole product is CRUD-heavy
  (accounts, expenses, groups, transfers) with straightforward request/response
  needs — API routes are enough, and colocating frontend + backend avoids
  managing two deployments/repos during local development.
- **MongoDB over a relational DB:** expense splits (Equal vs. Manual, varying
  numbers of participants) and group member records (registered vs. guest,
  with different shapes) map more naturally to flexible documents than to
  rigid relational schemas. The one place strict relationships matter most —
  the `Transaction` ledger referencing its source — is handled via
  `sourceType`/`sourceId` fields, which Mongoose can validate and populate.
- **Mongoose:** gives schema-level validation (e.g. an `Expense` must belong
  to a valid `Account`) without giving up MongoDB's document flexibility.

## 3. Local Development Environment

| Tool | Purpose |
|---|---|
| **Node.js** | JavaScript runtime for Next.js. |
| **MongoDB Community Server** (local) | Local database instance — no cloud dependency during development. |
| **MongoDB Compass** (optional) | GUI for inspecting collections/documents while building — useful for verifying `Transaction` rows are written correctly. |
| **npm / pnpm** | Package management. |
| **Git** | Version control. |

## 4. Key Libraries (by phase)

| Phase | Likely Libraries |
|---|---|
| 0 — Foundation | `mongoose`, `bcrypt` or `bcryptjs` (password hashing), `jsonwebtoken` or `next-auth` |
| 1–2 — Accounts, Expenses, Income | `mongoose` (schemas), `date-fns` or `dayjs` (date handling) |
| 3–4 — Groups | `mongoose`, `nodemailer` (guest invites) |
| 5–6 — Group Expenses, Transfers | `mongoose` (transactions/sessions for atomic multi-document writes — important when an expense debits one account and logs shares across several members) |
| 8 — Reporting | A charting library (e.g. `recharts`) for the dashboard, `csv-writer` or similar if CSV export is added |

## 5. Data Integrity Notes

Because money movement must stay accurate:

- **MongoDB transactions (sessions)** should be used wherever a single action
  needs to update more than one document atomically — e.g. creating a
  `GroupExpense` writes both the expense record *and* a `Transaction` against
  the payer's `Account`; both must succeed or both must roll back.
- **Validation at the schema level** (Mongoose) ensures amounts are positive,
  split shares sum correctly, and every `Transaction` has a valid `account`
  reference before it's saved.

## 6. Deployment (Future Consideration)

Currently local-only for development. When ready to deploy:
- MongoDB Atlas (managed MongoDB) as the natural next step from local MongoDB.
- Vercel as the natural deployment target for a Next.js app.
- Environment variables for DB connection string, JWT secret, and email
  service API keys, kept out of source control.
