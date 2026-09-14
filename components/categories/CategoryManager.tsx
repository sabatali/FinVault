"use client";

import { FormEvent, useState } from "react";

import type { CategoryKind, CategoryPublic } from "@/models/Category";

const KIND_LABELS: Record<CategoryKind, string> = {
  expense: "Expense",
  income: "Income",
  both: "Both",
};

interface CategoryManagerProps {
  initialCategories: CategoryPublic[];
}

export function CategoryManager({ initialCategories }: CategoryManagerProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refreshCategories() {
    const response = await fetch("/api/categories", { credentials: "include" });
    const data = (await response.json()) as {
      categories?: CategoryPublic[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error ?? "Unable to refresh categories.");
    }
    setCategories(data.categories ?? []);
  }

  const customCategories = categories.filter((category) => !category.isPredefined);
  const predefinedCategories = categories.filter((category) => category.isPredefined);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, kind }),
      });
      const data = (await response.json()) as {
        error?: string;
        fields?: Record<string, string>;
      };

      if (!response.ok) {
        setCreateError(data.fields?.name ?? data.error ?? "Unable to create category.");
        return;
      }

      setName("");
      await refreshCategories();
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(categoryId: string) {
    setBusyId(categoryId);
    setRowError(null);

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editName }),
      });
      const data = (await response.json()) as {
        error?: string;
        fields?: Record<string, string>;
      };

      if (!response.ok) {
        setRowError(data.fields?.name ?? data.error ?? "Unable to rename category.");
        return;
      }

      setEditingId(null);
      await refreshCategories();
    } catch {
      setRowError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(categoryId: string) {
    setBusyId(categoryId);
    setRowError(null);

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setRowError(data.error ?? "Unable to delete category.");
        return;
      }

      await refreshCategories();
    } catch {
      setRowError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-[#e4e7ee] bg-white p-5">
        <h2 className="text-lg font-semibold text-[#1a1d29]">Add custom category</h2>
        <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            type="text"
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Category name"
            className="rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
            required
          />
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as CategoryKind)}
            className="rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="both">Both</option>
          </select>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-[#2f5fdc] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {creating ? "Adding…" : "Add"}
          </button>
        </form>
        {createError ? (
          <p className="mt-2 text-sm text-red-600">{createError}</p>
        ) : null}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#1a1d29]">Your custom categories</h2>
        {rowError ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {rowError}
          </p>
        ) : null}
        {customCategories.length === 0 ? (
          <p className="mt-3 text-sm text-[#5a6072]">
            No custom categories. Predefined ones are always available.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {customCategories.map((category) => (
              <li
                key={category.id}
                className="rounded-xl border border-[#e4e7ee] bg-white p-4"
              >
                {editingId === category.id ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      maxLength={40}
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busyId === category.id}
                      onClick={() => void handleRename(category.id)}
                      className="rounded-lg bg-[#2f5fdc] px-3 py-2 text-sm font-semibold text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[#1a1d29]">{category.name}</p>
                      <p className="text-xs text-[#5a6072]">
                        {KIND_LABELS[category.kind]}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(category.id);
                          setEditName(category.name);
                          setRowError(null);
                        }}
                        className="text-sm font-medium text-[#2f5fdc]"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        disabled={busyId === category.id}
                        onClick={() => void handleDelete(category.id)}
                        className="text-sm font-medium text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#1a1d29]">Predefined categories</h2>
        <p className="mt-1 text-sm text-[#5a6072]">
          Built-in tags available to everyone. They cannot be edited or deleted.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {predefinedCategories.map((category) => (
            <li
              key={category.id}
              className="rounded-full bg-[#eef1f8] px-3 py-1 text-xs font-medium text-[#2f5fdc]"
            >
              {category.name} · {KIND_LABELS[category.kind]}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
