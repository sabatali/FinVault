"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { getSafeRedirectPath } from "@/lib/auth-routes";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = getSafeRedirectPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!email.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as {
        error?: string;
        fields?: Record<string, string>;
      };

      if (!response.ok) {
        if (data.fields) {
          setFieldErrors(data.fields);
        }
        setError(data.error ?? "Unable to log in.");
        setPassword("");
        return;
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-[#1a1d29]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          className="w-full rounded-lg border border-[#e4e7ee] px-3 py-2.5 text-base text-[#1a1d29] outline-none focus:border-[#2f5fdc] focus:ring-2 focus:ring-[#2f5fdc]/20"
        />
        {fieldErrors.email ? (
          <p id="email-error" className="mt-1 text-sm text-red-600">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-[#1a1d29]"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          className="w-full rounded-lg border border-[#e4e7ee] px-3 py-2.5 text-base text-[#1a1d29] outline-none focus:border-[#2f5fdc] focus:ring-2 focus:ring-[#2f5fdc]/20"
        />
        {fieldErrors.password ? (
          <p id="password-error" className="mt-1 text-sm text-red-600">
            {fieldErrors.password}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-[#1e3fae] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Logging in…" : "Log in"}
      </button>

      <p className="text-center text-sm text-[#5a6072]">
        Don&apos;t have an account?{" "}
        <Link
          href={
            searchParams.get("next")
              ? `/signup?next=${encodeURIComponent(searchParams.get("next")!)}`
              : "/signup"
          }
          className="font-medium text-[#2f5fdc] hover:underline"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
