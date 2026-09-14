# Feature 8.3 — Notifications (Email + In-App) for Key Events

> **Project:** FinVault  
> **Phase:** 8 — Polish & Reporting  
> **Feature ID:** 8.3  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · Nodemailer/Resend · JWT auth

## Context for the Implementer

Acceptance: *Expense added, settlement requested/confirmed all trigger notifications.*

TOOLS_AND_TECH: email for guest invites (3.4) **and** notification triggers (expense added, settlement requested).

Reuse `lib/email.ts`. Add in-app `Notification` documents for registered users. Guests get **email only** (they cannot open the in-app center) — for group expense added, email the guest address; for settlements involving guests, email the registered counterpart and the guest if they have email.

**Events (minimum):**

| Event | In-app (registered) | Email |
|---|---|---|
| Group expense added | All **other** registered participants/members? **All registered group members except actor** | Guests in the split + optional all |
| Settlement requested (pending) | **Receiver** | Receiver |
| Settlement confirmed | **Sender** | Sender |
| Settlement auto-confirmed | Registered party if they weren't the actor | Guest if any |

Do not email the actor about their own action.

---

## 1. Feature Overview

### Purpose

Tell people when money-related group events happen, both in the app and by email.

### Business objective

Settlements do not stall because the receiver never knew; members see new expenses quickly.

### User story

> When Ali logs a dinner or requests a settlement, I get an in-app notification and an email so I can confirm or check the split.

---

## 2. Functional Requirements

### Complete feature behavior

1. `Notification` model: user, type, title, body, read, `href`, `createdAt`.
2. Bell in AppShell with unread count; `/notifications` list; mark read on click or "Mark all read".
3. `notify({ userId, type, ... })` writes DB then `sendMail` (best-effort; DB notify must succeed even if email fails).
4. Hooks: after GroupExpense create; after transfer create pending; after confirm.
5. Dedup not required.

### Validation

- Cannot read another user's notifications.
- Types enum: `group_expense_added` | `settlement_requested` | `settlement_confirmed` | `settlement_auto_confirmed`.

### User interactions

- Bell dropdown latest 8 + "See all".
- Click → mark read → navigate href (group or transfer).

### Edge cases

- User has no email (should not happen): skip email.
- Email fail: in-app still there; log error.
- Actor excluded.

---

## 3. Technical Requirements

### Database

**Collection: `notifications`**

```ts
{
  user: ObjectId;
  type: string;
  title: string;
  body: string;
  href: string;
  readAt: Date | null;
  createdAt: Date;
}
```

Index `{ user: 1, createdAt: -1 }`.

### APIs

| Method | Path |
|---|---|
| GET | `/api/notifications?unread=1` |
| POST | `/api/notifications/read-all` |
| PATCH | `/api/notifications/[id]` `{ read: true }` |

### Background jobs

None required. If email is slow, `await` in the request or use `after()` in Next.js so the HTTP response isn't blocked too long — prefer **not blocking expense create**: fire email without awaiting in production, await in tests.

---

## 4. UI/UX Requirements

### Components

- `NotificationBell.tsx`
- `app/(app)/notifications/page.tsx`

### States

- **Empty:** "No notifications yet."
- **Unread:** badge count (cap 9+).
- **Error:** bell still renders.

### a11y

`aria-label="Notifications, 3 unread"`; list is `ul`.

---

## 5. Implementation Guidelines

### Steps

1. Model + notify helper.
2. Hook 3 call sites (expense, transfer pending, confirm).
3. Bell UI.
4. Reuse email templates style from 3.4.

### Security

- User-scoped queries.
- href internal paths only (prevent phishing via stored XSS — sanitize titles from your own strings, not user HTML).

---

## 6. Dependencies

- 3.4 email helper
- 5.1 expense create
- 6.1–6.3 transfers
- 0.3 AppShell

### Libraries

- Existing nodemailer/resend

---

## 7. Acceptance Criteria

- [ ] Adding a **group** expense notifies the other registered members in-app and emails guests as specified.
- [ ] Settlement requested notifies the receiver (in-app + email).
- [ ] Settlement confirmed notifies the sender (in-app + email).
- [ ] Actor does not receive a notification for their own action.
- [ ] Unread count and mark-read work; users cannot see others' notifications.
- [ ] Email failure does not roll back the expense/transfer.

**Out of scope:** push notifications, SMS, notification preferences beyond what's needed.
