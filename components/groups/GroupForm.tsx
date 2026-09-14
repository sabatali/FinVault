"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

interface GroupFormProps {
  mode: "create" | "edit";
  groupId?: string;
  initialName?: string;
}

export function GroupForm({ mode, groupId, initialName = "" }: GroupFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      if (mode === "create") {
        const response = await fetch("/api/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name }),
        });
        const data = (await response.json()) as {
          group?: { id: string };
          error?: string;
          fields?: Record<string, string>;
        };

        if (!response.ok) {
          if (data.fields) {
            setFieldErrors(data.fields);
          }
          setError(data.error ?? "Unable to create group.");
          return;
        }

        router.push(`/groups/${data.group?.id}?created=1`);
        router.refresh();
        return;
      }

      if (!groupId) {
        setError("Missing group id.");
        return;
      }

      const response = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as {
        error?: string;
        fields?: Record<string, string>;
        code?: string;
      };

      if (!response.ok) {
        if (response.status === 403 || data.code === "ADMIN_REQUIRED") {
          setError("Only admins can rename or delete this group.");
        } else if (data.fields) {
          setFieldErrors(data.fields);
          setError(data.error ?? "Unable to rename group.");
        } else {
          setError(data.error ?? "Unable to rename group.");
        }
        return;
      }

      router.push(`/groups/${groupId}?updated=1`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-4" noValidate>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <div>
        <label htmlFor="group-name" className="block text-sm font-medium text-[#1a1d29]">
          Group name
        </label>
        <input
          id="group-name"
          type="text"
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-lg border border-[#e4e7ee] px-3 py-2 text-sm text-[#1a1d29]"
          placeholder="Goa Trip, Flatmates…"
          required
        />
        {fieldErrors.name ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Link
          href={mode === "edit" && groupId ? `/groups/${groupId}` : "/groups"}
          className="inline-flex items-center justify-center rounded-lg border border-[#e4e7ee] px-4 py-2.5 text-sm font-medium text-[#1a1d29] hover:bg-[#f4f6fb]"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3fae] disabled:opacity-70"
        >
          {loading
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? "Create group"
              : "Save name"}
        </button>
      </div>
    </form>
  );
}
