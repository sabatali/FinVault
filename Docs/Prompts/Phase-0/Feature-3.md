# Feature 0.3 — Base Layout, Protected Route Wrapper & Navigation Shell

> **Project:** FinVault  
> **Phase:** 0 — Foundation (Next.js + MongoDB + Auth)  
> **Feature ID:** 0.3  
> **Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · JWT cookie auth from Feature 0.2

## Context for the Implementer

FinVault is a personal + group finance management system. After this feature, **every product page except auth and public landing is login-gated**. Later phases will drop screens into this shell (accounts, expenses, groups, dashboard) without re-implementing navigation or auth redirects.

Auth is already implemented (Feature 0.2): JWT in an httpOnly cookie named `finvault_token`, `GET /api/auth/me`, `POST /api/auth/logout`.

**Public routes (must remain accessible while logged out):**

- `/` (landing)
- `/login`
- `/signup`
- `/api/health`
- `/api/auth/login`, `/api/auth/signup` (and logout)

**Everything else** under the app (pages and APIs added from Phase 1 onward) is protected.

Guest users do not log in; they never see this shell. Only registered users do.

---

## 1. Feature Overview

### Purpose

Provide the authenticated application chrome: a persistent navigation shell, a protected layout that redirects logged-out users to login, and Next.js middleware that enforces the same rule at the edge for pages.

### Business objective

Users must never see another person's financial UI — or even an empty authenticated dashboard — without logging in. The shell also makes FinVault feel like one product as features are added.

### User story

> As a logged-out visitor, if I open `/dashboard` or any future app URL, I am sent to `/login` (with a return path).  
> As a logged-in user, I see a consistent nav (Dashboard, Accounts, and placeholders for later sections) and can log out.

---

## 2. Functional Requirements

### Complete feature behavior

1. **Next.js middleware** (`middleware.ts`)
   - Read `finvault_token`.
   - If missing on a protected page, redirect to `/login?next=<original-path>`.
   - If present on `/login` or `/signup`, redirect to `/dashboard` (already authenticated).
   - Verify the JWT in middleware using **`jose`** (Edge-compatible). Invalid token → treat as logged out (clear cookie optional, redirect to login).
2. **Protected app layout**
   - Route group `app/(app)/layout.tsx` wraps all authenticated pages.
   - Renders the navigation shell + `{children}`.
   - Optionally re-check `/api/auth/me` on the server to load the user name for the header (defense in depth; middleware is the first gate).
3. **Navigation shell**
   - App name: **FinVault**.
   - Links (enable only what exists; later items can be present but disabled or omitted until their phase):
     - Dashboard → `/dashboard` (placeholder page in this feature)
     - Accounts → `/accounts` (placeholder until Phase 1; include the link now so the shell is stable, page can be a "coming soon" **or** omit until 1.3 — **include the href now** with a minimal placeholder page so 1.3 replaces content rather than adding routes)
     - Groups → `/groups` (placeholder until Phase 3)
   - User menu: display name or email, **Log out** (POST `/api/auth/logout`, then redirect to `/login`).
4. **Login redirect `next` parameter**
   - After successful login/signup, if `?next=` is a **relative** path starting with `/` (and not `//` — open-redirect protection), send the user there; otherwise `/dashboard`.
5. **Placeholder `/dashboard`**
   - Authenticated-only. Simple heading: "Dashboard" and a sentence that personal totals will appear in Phase 2.

### Validation rules

- `next` query param: allow only internal paths. Reject `https://`, `//evil.com`, and `javascript:`.
- Logout always succeeds from the UI even if the API returns after cookie clear.

### User interactions

- Click nav links to move between placeholder pages without full layout remount flicker if using the same `(app)` layout.
- Log out from the header.
- Logged-out deep link `/accounts` → `/login?next=%2Faccounts` → after login, land on `/accounts`.

### Edge cases

- Expired JWT: redirect to login, do not render the shell with empty user.
- User deleted from DB but cookie still valid: `/api/auth/me` 401 → treat as logged out (protected layout should redirect).
- Open redirect via `next`.
- Middleware matcher must **not** block `/api/health` or static `_next` assets.
- Protect `/api/*` except the public auth + health routes: unauthenticated API calls return **401 JSON**, not an HTML redirect (so `fetch` can handle it). Pages get redirects; APIs get 401.

---

## 3. Technical Requirements

### Architecture considerations

- `middleware.ts` at project root (or `src/middleware.ts` if using `src/`).
- Split public vs protected with a matcher and an allowlist.
- Auth pages stay in `app/(auth)/` **without** the app chrome (no sidebar on login).
- App pages in `app/(app)/`.

### Database models/tables

No new models. Uses `User` from Feature 0.2.

### APIs and services

No new domain APIs. Uses:

- `GET /api/auth/me`
- `POST /api/auth/logout`

Middleware may verify JWT without a DB hit; the layout may still load the user from DB for the header.

### Background jobs or schedulers

None.

---

## 4. UI/UX Requirements

### Pages or components involved

- `app/(app)/layout.tsx` — shell
- `app/(app)/dashboard/page.tsx` — placeholder
- `app/(app)/accounts/page.tsx` — placeholder ("Accounts will appear here")
- `app/(app)/groups/page.tsx` — placeholder
- `components/layout/AppShell.tsx`
- `components/layout/Sidebar.tsx` (or top nav)
- `components/layout/UserMenu.tsx`

**Visual direction:** clean finance app — white/light gray background, a primary blue consistent with the phase-plan docs (`#2f5fdc` is acceptable as the brand accent), clear typography, not a dashboard-kit dump of charts yet.

### Loading, empty, success, and error states

- **Loading (auth check):** if the layout waits on `me`, show a full-shell skeleton or a centered spinner so the page does not flash login content.
- **Empty:** placeholder pages explain that data arrives in later phases — not a broken empty table.
- **Error:** if `me` fails with a network error (not 401), show a retry message inside the shell.
- **401:** redirect to login (pages) or JSON (APIs).

### Responsive behavior

- **Desktop:** persistent sidebar or top nav with all links visible.
- **Mobile:** hamburger or compact header; nav links in a drawer; logout reachable.
- Main content area has padding; no horizontal scroll on 375px width.

### Accessibility considerations

- `nav` landmark, skip-to-content link optional but recommended.
- Current route indicated with `aria-current="page"`.
- Mobile menu: focus trap while open, Escape to close, `aria-expanded` on the toggle.
- Logout is a real `button`, not a span.

---

## 5. Implementation Guidelines

### Step-by-step implementation approach

1. Confirm Feature 0.2 tokens can be verified with `jose` in Edge middleware. If 0.2 used `jsonwebtoken` only, add `jose` verify that shares `JWT_SECRET`.
2. Create `middleware.ts` with an allowlist of public paths. For `/api/*` protected routes, return `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`.
3. Create route groups `(auth)` vs `(app)` if not already split.
4. Build `AppShell` with nav + user menu.
5. Add placeholder pages for dashboard, accounts, groups.
6. Update login/signup client to honor `next` safely after Feature 0.2's redirect-to-dashboard.
7. Manually test logged-out visit to `/dashboard` and `/api/auth/me`.

### Recommended file structure

```text
middleware.ts
lib/
  auth.ts                 # Edge-safe verifyJwt for middleware
  auth-routes.ts          # PUBLIC_PATHS, isPublicPath()
app/
  (auth)/
    layout.tsx            # centered card layout, no sidebar
    login/page.tsx
    signup/page.tsx
  (app)/
    layout.tsx
    dashboard/page.tsx
    accounts/page.tsx
    groups/page.tsx
components/layout/
  AppShell.tsx
  Sidebar.tsx
  UserMenu.tsx
```

### Best practices

- Keep `PUBLIC_API_PREFIXES` in one module so Phase 1+ APIs are protected by default.
- Do not duplicate nav link lists in many files — one `NAV_ITEMS` array.
- Placeholder pages should be Server Components unless they need logout JS (logout can be a small Client Component in the header).

### Performance optimizations

- Middleware JWT verify only — no MongoDB in middleware.
- Layout user fetch: one `findById` on the server; pass name to the client header.

### Security considerations

- Open-redirect protection on `next`.
- Middleware matcher excludes `/_next/static`, `/favicon.ico`, images.
- Do not put PII in middleware logs.
- CSRF: logout is POST, not GET.

---

## 6. Dependencies

### Required features or services

- Feature 0.1 — app boots, DB connection.
- Feature 0.2 — User model, JWT cookie, login/signup/logout/me.

### External libraries

- `jose` (JWT verify in middleware)
- Tailwind CSS (already in project)

### Prerequisites

- A test user that can log in.
- `JWT_SECRET` identical for signing (0.2) and verifying (middleware).

---

## 7. Acceptance Criteria

- [ ] Logged-out user visiting `/dashboard`, `/accounts`, or `/groups` is redirected to `/login`.
- [ ] After login, the user is sent to the `next` path when it is a safe internal path; otherwise `/dashboard`.
- [ ] Logged-in user visiting `/login` or `/signup` is redirected to `/dashboard`.
- [ ] Authenticated shell shows FinVault branding, nav links, and the user's name or email.
- [ ] Log out clears the session and returns the user to `/login`; they cannot use the back button to view protected **data** (middleware/layout must re-check — a bfcache flash is acceptable if a subsequent check redirects).
- [ ] `GET /api/auth/me` without a token still returns 401 JSON (unchanged from 0.2).
- [ ] `GET /api/health` remains public.
- [ ] `next=https://evil.example` is ignored; user lands on `/dashboard`.
- [ ] Shell is usable on a mobile viewport (nav accessible, no clipped logout).

**Out of scope:** real dashboard numbers (Phase 2 / 8), account CRUD UI (Phase 1), group CRUD (Phase 3).
