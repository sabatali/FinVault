# Feature 3.4 — Guest Invite Email

> **Project:** FinVault  
> **Phase:** 3 — Groups (Structure Only)  
> **Feature ID:** 3.4  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Nodemailer or Resend/SendGrid · JWT auth

## Context for the Implementer

When an admin adds a **guest** (Feature 3.3), FinVault emails them an invite. Project acceptance: *Email sent on guest add, invite link works.*

TOOLS_AND_TECH: *Nodemailer / a transactional email service (e.g. Resend, SendGrid) — needed for guest invites and notification triggers.*

The invite link should take the guest to **signup** (Feature 0.2) with email prefilled. **Claiming** the `GroupMember` on signup is Phase 7. For this feature:

- Link must open (HTTP 200), prefill email, and include a signed `token` query param.
- If Phase 7 is not built, signup still creates a User; store the token so 7.1 can claim. Optionally implement a lightweight "pending claim" on the member (`inviteTokenHash`) now.

**Registered** members who already have accounts: send a simpler "you were added to group X" email **optional**; the plan specifically says **guest** invite. Focus on guests.

Local dev: log the invite URL to the server console **and** attempt SMTP if configured. Use Ethereal or Mailhog if no real SMTP. Never fail the whole "add member" transaction solely because email failed — **save the member, then send**; if send fails, surface a warning and a "Resend invite" button.

---

## 1. Feature Overview

### Purpose

Email guests when they are added to a group, with a working invite link toward signup/claim.

### Business objective

People without FinVault can be pulled into a group's bookkeeping and later become real users without the admin chasing them only in chat.

### User story

> As a group admin, when I add a guest, they receive an email with a link that opens FinVault signup for that invite.

---

## 2. Functional Requirements

### Complete feature behavior

1. On guest `GroupMember` create: generate a high-entropy token, store **hash** on the member (`inviteTokenHash`), send email with raw token in URL (raw token never stored).
2. Email contains: group name, inviter name, CTA link.
3. Link format: `{APP_URL}/signup?email=...&invite=TOKEN` (and optional `group` name for copy).
4. `GET` signup page reads `email` + `invite` and prefills email (read-only recommended).
5. `POST /api/groups/[id]/members/[memberId]/resend-invite` admin-only, guests only.
6. Token expiry: 14 days; expired link shows "Invite expired, ask an admin to resend."

### Validation rules

- Only `memberType: guest` gets this invite.
- Resend regenerates token (invalidate old).

### User interactions

- Admin sees "Invite sent" or "Invite failed — Resend".
- Guest clicks link → signup form.

### Edge cases

- Email service down: member still created; warning in API `{ inviteSent: false }`.
- Duplicate send spam: resend rate-limit 1 per 2 minutes per member (simple in-memory or `inviteSentAt` check).
- Token in server logs: allowed in development only, never in production logs.

---

## 3. Technical Requirements

### Architecture

`lib/email.ts` abstraction: `sendMail({ to, subject, html })` so Phase 8.3 reuses it. Nodemailer for local SMTP; interface allows Resend later.

### Models

Update `GroupMember`: `inviteTokenHash`, `inviteSentAt`, `inviteExpiresAt`.

### APIs

- Hook into POST members.
- POST resend-invite.

Public: signup page already public. Optional `GET /api/invites/preview?token=` is **not** required (avoid leaking group names to the world without the token — the token **is** the secret; a small `GET /api/invites/[token]` returning `{ email, groupName }` is OK to render a nicer landing).

### Env

| Variable | Purpose |
|---|---|
| `APP_URL` | e.g. `http://localhost:3000` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Nodemailer |
| `EMAIL_FROM` | `FinVault <noreply@localhost>` |
| `RESEND_API_KEY` | Alternative |

### Background jobs

None required; send inline `await sendMail`. If slow, fire-and-forget with `waitUntil` — still OK to await in dev.

---

## 4. UI/UX Requirements

### Pages

- Signup prefill from query.
- Optional `/invite/[token]` landing: "Join {group} on FinVault" → signup.

### States

- Invalid/expired token: error page, not a crash.
- Success email: admin toast.

### Responsive / a11y

Standard auth form; link must be keyboard reachable in the email (that's the client). In-app: resend button labeled.

---

## 5. Implementation Guidelines

### Steps

1. `lib/email.ts` + HTML template (plain-text alternative part).
2. Token: `crypto.randomBytes(32).toString("hex")`, store sha256 hash.
3. Integrate with add-guest.
4. Prefill signup.
5. Document `.env.example`.
6. Dev: if SMTP missing, `console.info("[invite]", url)` and return `inviteSent: false` with `devInviteUrl` **only when NODE_ENV=development**.

### Security

- Hash tokens at rest.
- Do not put tokens in GroupMember GET list responses.
- `APP_URL` only, no open redirects.

---

## 6. Dependencies

- 3.3 add guest
- 0.2 signup page
- Email provider **or** console fallback for local

### Libraries

- `nodemailer` (+ `@types/nodemailer`)
- or `resend`

---

## 7. Acceptance Criteria

- [ ] Adding a guest triggers an email send attempt.
- [ ] Invite link opens the app (signup or invite landing) without 404.
- [ ] Email is prefilled from the invite.
- [ ] Admin can resend.
- [ ] Failed SMTP does not roll back guest creation.
- [ ] Production responses never include the raw invite URL.

**Out of scope:** full claim of GroupMember._id (7.1), in-app notification center (8.3), adding registered-user emails.
