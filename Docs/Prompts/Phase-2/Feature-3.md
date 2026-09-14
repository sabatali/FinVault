# Feature 2.3 — Categories (Predefined + Custom)

> **Project:** FinVault  
> **Phase:** 2 — Individual Income & Expenses  
> **Feature ID:** 2.3  
> **Stack:** Next.js (App Router) · TypeScript · MongoDB/Mongoose · Tailwind CSS · JWT auth

## Context for the Implementer

Personal `Expense` (2.1) and `Income` (2.2) documents should be **tagged** with a category so the personal dashboard (2.4) can show spend-by-category. Project plan: *predefined + custom, applied to expenses / income; entries can be tagged and filtered by category.*

Categories apply to **personal** entries in this phase. Group expenses (Phase 5) may show a simple description only unless you reuse categories — **do not require** group expenses to use this catalog.

**Predefined categories** are global (no `user`, `isPredefined: true`). **Custom categories** belong to one user. A user must not see another user's custom names.

Seed predefined categories on first boot or via a script called from Feature 0.1's app init (lazy seed in `GET /api/categories` is acceptable).

---

## 1. Feature Overview

### Purpose

Provide a category catalog (system defaults + per-user custom) and attach categories to expenses and income, including filter-by-category on lists.

### Business objective

Users understand where money went (Food, Transport, Rent) rather than a flat dump of ledger lines — required for dashboard breakdowns.

### User story

> As a user, I want to tag expenses and income with categories (including ones I create) and filter my lists by those tags.

---

## 2. Functional Requirements

### Complete feature behavior

1. `Category` model: name, kind (`expense` | `income` | `both`), `user` nullable, `isPredefined`.
2. Seed at least these predefined **expense** categories: Food, Transport, Rent/Housing, Utilities, Health, Shopping, Entertainment, Education, Other.
3. Seed at least these predefined **income** categories: Salary, Freelance, Gift, Refund, Other.
4. `GET /api/categories?kind=expense|income` returns predefined + current user's custom, sorted (predefined first, then custom A–Z).
5. `POST /api/categories` creates a custom category for the current user.
6. `PATCH` / `DELETE` custom categories only. **Cannot** mutate predefined. Delete: if in use, either block 409 or set existing entries' category to null — **recommended: block 409** with count of usages.
7. Expense and Income forms: category `<select>` required **or** optional with "Uncategorized". Project says "applied to" — make category **required** on create for a better dashboard; allow Uncategorized as a predefined option so users are not blocked.
8. List filters: `?categoryId=` on `/api/expenses` and `/api/income`.
9. UI to manage custom categories (settings section on `/expenses` or `/settings/categories`).

### Validation rules

| Field | Rules |
|---|---|
| `name` | Required, trimmed, 1–40 chars. Unique per `(user, kind, nameNormalized)` for custom; predefined names unique globally per kind. |
| `kind` | `expense` \| `income` \| `both`. |
| Duplicate custom name (case-insensitive) | 409. |

### User interactions

- On expense/income forms, dropdown of relevant categories + "Add category" that creates and selects.
- Category manager: list custom, add, rename, delete.
- Filter chips or select on expense/income lists.

### Edge cases

- User A must not use user B's custom category id (validate ownership or predefined).
- Deleting a category in use: 409.
- `kind: both` appears in both dropdowns.
- Seeding twice must not duplicate predefined (unique index on `{ isPredefined: true, nameNormalized, kind }`).

---

## 3. Technical Requirements

### Architecture considerations

Store `nameNormalized` (lowercase) for uniqueness. Expenses/incomes already have `category` ref from 2.1/2.2 — wire it up if it was left null.

### Database models/tables

**Collection: `categories`**

```ts
{
  name: string;
  nameNormalized: string;
  kind: "expense" | "income" | "both";
  user: ObjectId | null;
  isPredefined: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: unique sparse/partial as needed so predefined and custom do not collide incorrectly.

### APIs and services

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/categories` | List for current user + predefined. |
| POST | `/api/categories` | Create custom. |
| PATCH | `/api/categories/[id]` | Rename own custom. |
| DELETE | `/api/categories/[id]` | Delete own custom if unused. |

Update expense/income POST/PATCH to accept `categoryId` and validate.

### Background jobs or schedulers

None. Seed on startup or first GET.

---

## 4. UI/UX Requirements

### Pages or components involved

- `components/categories/CategorySelect.tsx`
- `components/categories/CategoryManager.tsx`
- Filters on expense and income lists
- Optional `app/(app)/settings/categories/page.tsx`

### Loading, empty, success, and error states

- **Select loading:** disabled select "Loading categories…"
- **Empty custom list:** "No custom categories. Predefined ones are always available."
- **Success:** new custom appears immediately in the open select.
- **Error:** duplicate name message.

### Responsive behavior

Dropdowns full width on mobile. Manager as a simple list, not a cramped table.

### Accessibility considerations

- `label` for category select.
- Combobox if you implement "add inline" — otherwise select + button is fine.

---

## 5. Implementation Guidelines

### Step-by-step implementation approach

1. Category schema + seed function `ensurePredefinedCategories()`.
2. Category APIs with auth.
3. Validate `categoryId` in expense/income handlers.
4. Wire forms and list filters.
5. Seed check: Compass shows predefined rows with `user: null`.

### Recommended file structure

```text
models/Category.ts
lib/seed-categories.ts
app/api/categories/route.ts
app/api/categories/[id]/route.ts
components/categories/
```

### Best practices

- Do not let clients send `isPredefined: true`.
- Include `Uncategorized` as predefined `both` or allow null category — pick one; dashboard 2.4 must treat null as "Uncategorized".

### Performance optimizations

- Categories are a small collection; cache GET in memory for the request only.
- Indexes for expense list filter `{ user, category, occurredAt }`.

### Security considerations

- Custom category IDs scoped to user.
- Predefined IDs are global (read-only).

---

## 6. Dependencies

### Required features or services

- 2.1 Expense APIs/UI
- 2.2 Income APIs/UI

### External libraries

- None new.

### Prerequisites

- Expense and income forms exist to attach the select.

---

## 7. Acceptance Criteria

- [ ] Entries can be tagged with predefined and custom categories.
- [ ] Expense and income lists can be filtered by category.
- [ ] Custom category create/rename/delete works for the owner only.
- [ ] Predefined categories cannot be edited or deleted.
- [ ] Another user's custom categories never appear in the dropdown.
- [ ] Seeding is idempotent (no duplicate predefined rows).
- [ ] Unused custom delete succeeds; in-use delete is blocked with a clear error.

**Out of scope:** dashboard charts (2.4), group expense categories, budgets.
