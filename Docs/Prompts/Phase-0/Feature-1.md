# Feature 0.1 — Next.js Project Setup & MongoDB Connection

> **Project:** FinVault  
> **Phase:** 0 — Foundation (Next.js + MongoDB + Auth)  
> **Feature ID:** 0.1  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB (local) · Mongoose · Tailwind CSS

## Context for the Implementer

FinVault is a personal + group finance management system. A user's `Account` balance is the **single source of truth** for their money. Every credit or debit — personal grocery, group dinner, settlement — writes a row to a single `Transaction` ledger. Group splits and "who owes whom" sit **on top of** that ledger, not beside it.

This is the first feature of the project. You are bootstrapping the application so later phases can build models, APIs, and UI on a working Next.js + MongoDB foundation. There is **no separate Express server**. Next.js API route handlers are the backend.

**Architectural decisions already locked in (do not change them):**

- Next.js App Router, single codebase for frontend + backend.
- MongoDB running **locally** for development (no Atlas required yet).
- Mongoose as the ODM.
- TypeScript recommended for all models, API handlers, and shared types.
- Tailwind CSS for styling.
- All money amounts will later be stored in a **single base currency (PKR)**. Conversion is display-only (Phase 8).
- Balances are **never** edited as a free-standing mutable field; they are the result of ledger entries (enforced from Phase 1 onward).

---

## 1. Feature Overview

### Purpose

Initialize a production-shaped Next.js App Router project, connect it to a local MongoDB instance via Mongoose, and expose a health endpoint that proves both the app and the database are alive.

### Business objective

Give the team a runnable local environment before any domain models exist, so subsequent features (auth, accounts, expenses, groups) can be implemented without redoing scaffolding.

### User story

> As a developer, I want to start the FinVault app locally and hit `/api/health` so that I can confirm the Next.js server is up and MongoDB is connected before building any product features.

---

## 2. Functional Requirements

### Complete feature behavior

1. Scaffold (or verify) a Next.js App Router project at the FinVault repository root (parent of `Docs/` if this repo is docs-only — the app lives in the money-management project, **not** inside `Docs/`).
2. Enable TypeScript (`tsconfig.json` with strict mode).
3. Enable Tailwind CSS and a minimal global stylesheet.
4. Implement a reusable MongoDB connection helper that:
   - Reads `MONGODB_URI` from environment variables.
   - Uses a **cached connection** across hot reloads (Next.js serverless/dev pattern — store the promise on `globalThis` so HMR does not open a new connection every request).
   - Connects with Mongoose.
5. Expose `GET /api/health` that:
   - Attempts a DB ping (`mongoose.connection.readyState` and/or `db.admin().ping()`).
   - Returns JSON indicating app status and DB status.
6. Provide a `.env.example` documenting required variables. Do **not** commit secrets.
7. Provide a root `README` section (or update existing README) with local setup: Node.js, MongoDB Community Server, `npm install`, copy env, `npm run dev`.

### Validation rules

- `MONGODB_URI` is required. If missing, the health endpoint returns a clear 503/error payload — do not crash the whole Next.js process on a missing env during page render of public pages.
- Health response must distinguish: app up + DB down vs. both up.

### User interactions

None for end users. This is developer-facing infrastructure. Optional: a simple home page (`/`) that says "FinVault" and links nowhere protected yet (auth comes in 0.2–0.3).

### Edge cases

- MongoDB is not running: `/api/health` must fail gracefully with `ok: false` and a readable `db` error, HTTP 503.
- Invalid URI: same graceful failure, do not leak the full URI in the response.
- Hot reload in `next dev`: must not leak connections (cached mongoose connection).
- `GET /api/health` is **public** (no auth). Later phases protect everything else.

---

## 3. Technical Requirements

### Architecture considerations

- App Router: `app/` directory.
- API: Route Handlers in `app/api/.../route.ts`.
- Shared server utilities in `lib/` (never import Mongoose from Client Components).
- Keep the connection helper server-only.

### Database models/tables

None yet. Do not create `User`, `Account`, or `Transaction` in this feature.

### APIs and services

**`GET /api/health`**

Success (HTTP 200):

```json
{
  "ok": true,
  "app": "finvault",
  "env": "development",
  "db": {
    "connected": true,
    "readyState": 1
  }
}
```

Failure (HTTP 503):

```json
{
  "ok": false,
  "app": "finvault",
  "db": {
    "connected": false,
    "readyState": 0,
    "error": "MongoDB connection failed"
  }
}
```

Do not include credentials, connection strings, or stack traces in the JSON body.

### Background jobs or schedulers

None.

### Environment variables

| Variable | Required | Example |
|---|---|---|
| `MONGODB_URI` | Yes | `mongodb://127.0.0.1:27017/finvault` |
| `NODE_ENV` | Set by Next | `development` |

---

## 4. UI/UX Requirements

### Pages or components involved

- `app/layout.tsx` — root layout with `<html lang="en">`, Tailwind, a sensible font stack.
- `app/page.tsx` — minimal landing: product name "FinVault" and a one-line tagline ("Personal and group finance, one ledger"). No login UI yet (that is Feature 0.2).
- `app/globals.css` — Tailwind directives.

### Loading, empty, success, and error states

Health is API-only. Landing page is static; no loading spinner required.

### Responsive behavior

Landing page must be readable on mobile (simple centered content, max-width container).

### Accessibility considerations

- Valid heading hierarchy (`h1` for FinVault).
- Sufficient color contrast on the landing page.
- `lang="en"` on `<html>`.

---

## 5. Implementation Guidelines

### Step-by-step implementation approach

1. Create the Next.js App Router + TypeScript + Tailwind app (`create-next-app` with App Router, TypeScript, Tailwind, ESLint, `src/` optional — prefer **no** `src/` unless the repo already uses it; keep `app/` at project root for simplicity).
2. Add `mongoose` dependency.
3. Create `lib/db.ts`:
   - Export `connectDB()`.
   - Cache connection on `globalThis` in development.
   - Call `mongoose.connect(uri)` with reasonable options (`bufferCommands` as needed).
4. Create `app/api/health/route.ts` that calls `connectDB()`, pings, returns JSON.
5. Add `.env.local` (gitignored) and `.env.example`.
6. Confirm `.gitignore` includes `.env*`, `node_modules`, `.next`.
7. Smoke-test: start MongoDB locally, `npm run dev`, `curl http://localhost:3000/api/health`.

### Recommended file structure

```text
finvault/                          # application root (not Docs/)
├── app/
│   ├── api/
│   │   └── health/
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   └── db.ts
├── .env.example
├── .env.local                     # gitignored
├── .gitignore
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

### Best practices

- `"use server"` is not needed on route handlers; they are already server-side.
- Never import `lib/db.ts` from a Client Component.
- Use named export `connectDB` and always `await` it at the start of API handlers in later features.
- Pin Node.js 20+ if documenting engine versions.

### Performance optimizations

- Cached Mongoose connection is mandatory in Next.js to avoid connection storms.
- Health check should be cheap (ping only, no collection scans).

### Security considerations

- Do not log `MONGODB_URI` in full.
- Do not expose internal error messages that include host credentials.
- CORS is not a concern for same-origin App Router, but do not mark health as a debug dump of env vars.

---

## 6. Dependencies

### Required features or services

- None (this is the first feature).

### External libraries

- `next` (App Router)
- `react`, `react-dom`
- `mongoose`
- `typescript`, `@types/node`, `@types/react`
- `tailwindcss`, `postcss`, `autoprefixer` (or Tailwind v4 setup from `create-next-app`)

### Prerequisites

- Node.js installed.
- MongoDB Community Server running locally on the default port (27017) with a database name such as `finvault`.

---

## 7. Acceptance Criteria

- [ ] `npm run dev` starts the Next.js app without compile errors.
- [ ] Visiting `/` renders a simple FinVault landing page.
- [ ] With MongoDB running, `GET /api/health` returns HTTP 200 and `"ok": true` with `"db.connected": true`.
- [ ] With MongoDB stopped (or invalid URI), `GET /api/health` returns HTTP 503 and `"ok": false` without crashing the process.
- [ ] Mongoose connection is cached across hot reloads (no unbounded connection growth in `next dev`).
- [ ] `.env.example` documents `MONGODB_URI`; secrets are not committed.
- [ ] TypeScript compiles (`npx tsc --noEmit` or `next build` type-check) with no errors in the files this feature adds.

**Out of scope:** authentication, User model, protected routes, accounts, any domain CRUD.
