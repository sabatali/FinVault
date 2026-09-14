"use client";

import { useEffect, useRef, useState } from "react";

import type { CategoryKind, CategoryPublic } from "@/models/Category";

interface CategorySelectProps {
  id?: string;
  kind: "expense" | "income";
  value: string;
  onChange: (categoryId: string) => void;
  error?: string;
  disabled?: boolean;
}

export function CategorySelect({
  id = "category",
  kind,
  value,
  onChange,
  error,
  disabled = false,
}: CategorySelectProps) {
  const [categories, setCategories] = useState<CategoryPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  const defaultAppliedRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    defaultAppliedRef.current = false;

    async function loadCategories() {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(`/api/categories?kind=${kind}`, {
          credentials: "include",
        });
        const data = (await response.json()) as {
          categories?: CategoryPublic[];
          error?: string;
        };

        if (!response.ok) {
          if (!cancelled) {
            setLoadError(data.error ?? "Unable to load categories.");
            setCategories([]);
          }
          return;
        }

        if (!cancelled) {
          setCategories(data.categories ?? []);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Unable to load categories.");
          setCategories([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  useEffect(() => {
    if (loading || defaultAppliedRef.current || value) {
      return;
    }

    const uncategorized = categories.find(
      (category) =>
        category.isPredefined &&
        category.name.toLowerCase() === "uncategorized",
    );

    if (uncategorized) {
      defaultAppliedRef.current = true;
      onChangeRef.current(uncategorized.id);
    }
  }, [categories, loading, value]);

  async function handleCreate() {
    if (!newName.trim() || creating) {
      return;
    }

    setCreateError(null);
    setCreating(true);

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newName,
          kind: kind as CategoryKind,
        }),
      });
      const data = (await response.json()) as {
        category?: CategoryPublic;
        error?: string;
        fields?: Record<string, string>;
      };

      if (!response.ok) {
        setCreateError(data.fields?.name ?? data.error ?? "Unable to create category.");
        return;
      }

      if (data.category) {
        setCategories((current) => {
          const without = current.filter((item) => item.id !== data.category!.id);
          return [...without, data.category!].sort((a, b) => {
            if (a.isPredefined !== b.isPredefined) {
              return a.isPredefined ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });
        });
        onChange(data.category.id);
        setNewName("");
        setShowAdd(false);
      }
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[#1a1d29]">
        Category
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || loading}
        className="mt-1 w-full rounded-lg border border-[#e4e7ee] bg-white px-3 py-2 text-sm text-[#1a1d29] disabled:opacity-70"
        required
      >
        {loading ? <option value="">Loading categories…</option> : null}
        {!loading && !value ? <option value="">Select a category</option> : null}
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
            {category.isPredefined ? "" : " (custom)"}
          </option>
        ))}
      </select>
      {loadError ? <p className="mt-1 text-xs text-red-600">{loadError}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}

      <div className="mt-2">
        {showAdd ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              maxLength={40}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreate();
                }
              }}
              placeholder="New category name"
              className="w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating || !newName.trim()}
                className="rounded-lg bg-[#2f5fdc] px-3 py-2 text-sm font-semibold text-white disabled:opacity-70"
              >
                {creating ? "Adding…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setCreateError(null);
                  setNewName("");
                }}
                className="rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="text-sm font-medium text-[#2f5fdc] hover:underline"
          >
            Add category
          </button>
        )}
        {createError ? (
          <p className="mt-1 text-xs text-red-600">{createError}</p>
        ) : null}
      </div>
    </div>
  );
}
