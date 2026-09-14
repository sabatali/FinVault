# Feature 0.2 — User Model, Signup & Login (JWT)

> **Project:** FinVault  
> **Phase:** 0 — Foundation (Next.js + MongoDB + Auth)  
> **Feature ID:** 0.2  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT in httpOnly cookies · bcryptjs

## Context for the Implementer

FinVault is a personal + group finance management system. Registered users own real `Account`s and a `Transaction` ledger. Guests (added later in Phase 3) have no login.

**Auth decision for this project (finalize it here and keep it for all later phases):**

Use **custom JWT authentication** stored in an **httpOnly, Secure (prod), SameSite=Lax cookie** — not localStorage. Hash passwords with **bcryptjs**. Protect API routes by reading the cookie and verifying the JWT. Do **not** introduce NextAuth unless the repo already has it; stay consistent with `jsonwebtoken` (or `jose`) + cookies so later route handlers stay simple.

There are two user types in the product:

| Type | This feature |
|---|---|
| **Registered user** | Created here. Can log in. Will later own Accounts and Transactions. |
| **Guest** | Out of scope. Guests are `GroupMember` records with no `User` (Phase 3). Claiming is Phase 7. |

**Signup email matching for guest claim is Phase 7.** In this feature, signup simply creates a `User`. You may store email in a normalized (lowercase, trimmed) form so Phase 7 can match it later — do that now.

All amounts in FinVault will later be stored in **PKR** as the base currency. Add `preferredCurrency` on User now (default `"PKR"`) so display conversion in Phase 8 has a place to live.

---

## 1. Feature Overview

### Purpose

Define the `User` identity model and allow a person to register, log in, log out, and call a "who am I" endpoint. Unauthenticated API calls to protected handlers must be rejected.

### Business objective

Establish a real FinVault account holder — the identity that will own accounts, expenses, groups, and settlements.

### User story

> As a new user, I want to sign up with email and password and log in so that my personal ledger and future groups are tied to my identity.  
> As the system, I want to reject unauthenticated requests to protected APIs so that one user cannot read another user's money data.

---

## 2. Functional Requirements

### Complete feature behavior

1. **Signup**
   - Collect name, email, password (and optional password confirmation on the UI).
   - Normalize email: trim + lowercase.
   - Reject duplicate emails with a clear 409.
   - Hash password with bcrypt (cost factor 10–12). Never store plaintext.
   - Create the User document.
   - On success, issue JWT and set the auth cookie (user is logged in immediately).
2. **Login**
   - Email + password.
   - Generic error on failure ("Invalid email or password") — do not reveal whether the email exists.
   - On success, issue JWT and set the auth cookie.
3. **Logout**
   - Clear the auth cookie.
4. **Current user**
   - `GET /api/auth/me` returns the authenticated user (id, name, email, preferredCurrency) or 401.
5. **Protected API example**
   - Implement a small helper `requireAuth(request)` used by `/api/auth/me`. Any request without a valid token returns **401** with a stable JSON shape `{ "error": "Unauthorized" }`.

### Validation rules

| Field | Rules |
|---|---|
| `name` | Required, 1–80 characters, trimmed. |
| `email` | Required, valid email format, unique, stored lowercase. |
| `password` | Required, minimum 8 characters. Do not max-restrict unreasonably (cap at 128 to avoid bcrypt DoS). |
| `preferredCurrency` | Optional on signup; default `"PKR"`. ISO-like code, uppercase, 3 letters. |

Password is never returned in any API response.

### User interactions

- `/signup` form: name, email, password, confirm password.
- `/login` form: email, password, link to signup.
- Client-side validation for empty fields and password mismatch; server remains the source of truth.
- After signup or login, redirect to `/dashboard` (the dashboard page itself is a placeholder until Phase 2; Feature 0.3 will wrap it as protected).
- Logout control can live in the nav shell (Feature 0.3). Provide `POST /api/auth/logout` in this feature so 0.3 can call it.

### Edge cases

- Duplicate email → 409, no user created.
- Timing: use the same response timing pattern where practical (still hash on login only when user exists; dummy hash optional, not required).
- JWT expired or tampered → 401.
- Missing cookie → 401.
- Extra fields in body ignored.
- Concurrent double-submit on signup: unique index on email must make one fail cleanly.

---

## 3. Technical Requirements

### Architecture considerations

- Server-only auth helpers in `lib/auth.ts` (sign/verify JWT, cookie name, `requireAuth`).
- Mongoose model in `models/User.ts`.
- Route handlers under `app/api/auth/`.
- Cookie options: `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `secure` when `NODE_ENV === "production"`, maxAge matching JWT expiry (e.g. 7 days).
- JWT payload: `{ sub: userId, email }` only. Do not put the password hash in the token.

### Database models/tables

**Collection: `users`**

```ts
{
  name: string;
  email: string;            // unique, lowercase
  passwordHash: string;
  preferredCurrency: string; // default "PKR"
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: unique index on `email`.

### APIs and services

| Method | Path | Auth | Behavior |
|---|---|---|---|
| POST | `/api/auth/signup` | Public | Create user, set cookie, return user (no password). |
| POST | `/api/auth/login` | Public | Verify credentials, set cookie, return user. |
| POST | `/api/auth/logout` | Cookie optional | Clear cookie, `{ ok: true }`. |
| GET | `/api/auth/me` | Required | Return current user or 401. |

**Signup/login success body:**

```json
{
  "user": {
    "id": "...",
    "name": "Ayesha",
    "email": "ayesha@example.com",
    "preferredCurrency": "PKR"
  }
}
```

**401 body (protected routes):**

```json
{ "error": "Unauthorized" }
```

### Background jobs or schedulers

None.

### Environment variables

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | From Feature 0.1 |
| `JWT_SECRET` | Required, long random string. Never commit. |
| `JWT_EXPIRES_IN` | Optional, default `7d` |

---

## 4. UI/UX Requirements

### Pages or components involved

- `app/(auth)/login/page.tsx`
- `app/(auth)/signup/page.tsx`
- Shared form components as needed (`components/auth/LoginForm.tsx`, `SignupForm.tsx`).
- Use Tailwind: card on a muted background, primary button, text links between login/signup.

Keep auth pages visually consistent with Feature 0.3's shell (simple, clean, not a marketing site).

### Loading, empty, success, and error states

- **Loading:** disable submit button, show "Signing up…" / "Logging in…" on the button.
- **Error:** inline alert above the form (duplicate email, invalid credentials, network error).
- **Success:** redirect to `/dashboard`.
- **Empty:** default empty fields, no leftover values after error except email (keep email, clear password).

### Responsive behavior

Forms max-width ~400–440px, centered, usable on mobile (16px input font to avoid iOS zoom). Full-width inputs and button.

### Accessibility considerations

- Every input has a visible `<label>`.
- `type="email"` / `type="password"`, `autoComplete="email"`, `new-password` / `current-password`.
- Errors associated via `aria-invalid` and `aria-describedby`.
- Focus visible on inputs and buttons.
- Keyboard-submittable forms.

---

## 5. Implementation Guidelines

### Step-by-step implementation approach

1. Add `bcryptjs` and `jsonwebtoken` (plus `@types/bcryptjs`, `@types/jsonwebtoken`) **or** `jose` for Edge-compatible verify (if you plan to verify JWT in Next.js `middleware.ts` in Feature 0.3, **prefer `jose`** — `jsonwebtoken` is not Edge-compatible). Recommendation: **`jose` + bcryptjs** so Feature 0.3 middleware can verify the same token.
2. Create `models/User.ts` with schema, unique email, timestamps, a `toJSON` transform that never includes `passwordHash`.
3. Create `lib/auth.ts`: `hashPassword`, `verifyPassword`, `signToken`, `verifyToken`, `setAuthCookie`, `clearAuthCookie`, `getUserIdFromRequest`, `requireAuth`.
4. Implement the four auth route handlers. Always `await connectDB()` first.
5. Build login and signup pages as Client Components that `fetch` the APIs with `credentials: "include"`.
6. Add `JWT_SECRET` to `.env.example` and `.env.local`.

### Recommended file structure

```text
app/
  (auth)/
    login/page.tsx
    signup/page.tsx
  api/auth/
    signup/route.ts
    login/route.ts
    logout/route.ts
    me/route.ts
lib/
  db.ts                 # from 0.1
  auth.ts
  validators/auth.ts    # optional zod schemas
models/
  User.ts
components/auth/
  LoginForm.tsx
  SignupForm.tsx
```

### Best practices

- Use a validation library (`zod`) for request bodies; return 400 with field errors `{ error, fields }`.
- Select queries with `.select("-passwordHash")` as defense in depth.
- Cookie name: `finvault_token` (stable; do not change in later phases).

### Performance optimizations

- Unique index on email (not a JS uniqueness check alone).
- Do not add extra DB round-trips on `/me` beyond `findById`.

### Security considerations

- httpOnly cookie — XSS cannot read the token.
- bcrypt cost 10+ .
- Rate limiting is out of scope for local Phase 0 but do not log passwords.
- CSRF: SameSite=Lax is acceptable for this local-first app. Do not accept JWT from `Authorization` header *and* query string; cookie only (or cookie + optional Bearer, but pick one and document it — **cookie only**).
- Never return `passwordHash`.

---

## 6. Dependencies

### Required features or services

- Feature 0.1 — Next.js app, `connectDB()`, MongoDB running.

### External libraries

- `bcryptjs`
- `jose` (recommended) or `jsonwebtoken`
- `zod` (recommended for body validation)

### Prerequisites

- `MONGODB_URI` working (`GET /api/health` ok).
- `JWT_SECRET` set.

---

## 7. Acceptance Criteria

- [ ] A new user can register with name, email, and password; a `users` document is created with a bcrypt `passwordHash` (not plaintext).
- [ ] Duplicate email signup returns 409 and does not create a second user.
- [ ] Login with correct credentials sets an httpOnly auth cookie and returns the user (no password fields).
- [ ] Login with wrong password or unknown email returns 401 with a generic message.
- [ ] `GET /api/auth/me` with a valid cookie returns the user.
- [ ] `GET /api/auth/me` with no cookie or an invalid/expired token returns 401 `{ "error": "Unauthorized" }`.
- [ ] Logout clears the cookie; subsequent `/api/auth/me` is 401.
- [ ] Email is stored normalized (lowercase, trimmed).
- [ ] Password validation rejects passwords shorter than 8 characters (400).
- [ ] Unique index exists on `email`.

**Out of scope:** middleware redirects for pages (Feature 0.3), guest claiming (Phase 7), password reset, OAuth, email verification.
