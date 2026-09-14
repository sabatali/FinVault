"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { getSafeRedirectPath } from "@/lib/auth-routes";
import type { ClaimedGroupInfo } from "@/lib/claim";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = getSafeRedirectPath(searchParams.get("next"));
  const inviteToken = searchParams.get("invite")?.trim() || "";
  const inviteEmail = searchParams.get("email")?.trim() || "";
  const inviteGroup = searchParams.get("group")?.trim() || "";
  const emailLocked = Boolean(inviteEmail && inviteToken);

  const [name, setName] = useState("");
  const [email, setEmail] = useState(inviteEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function buildPostSignupPath(
    claimedGroups: ClaimedGroupInfo[],
    inviteWarning?: string,
  ): string {
    const hasExplicitNext = Boolean(searchParams.get("next"));
    if (hasExplicitNext) {
      return redirectPath;
    }

    if (claimedGroups.length === 1) {
      const group = claimedGroups[0]!;
      const params = new URLSearchParams({
        claimed: "1",
        linkAccount: "1",
      });
      if (inviteWarning) {
        params.set("inviteWarning", "1");
      }
      return `/groups/${group.groupId}?${params.toString()}`;
    }

    if (claimedGroups.length > 1) {
      const params = new URLSearchParams({ claimed: "1" });
      params.set(
        "claimedNames",
        claimedGroups.map((group) => group.groupName).join("|"),
      );
      if (inviteWarning) {
        params.set("inviteWarning", "1");
      }
      return `/groups?${params.toString()}`;
    }

    if (inviteWarning) {
      return `/dashboard?inviteWarning=1`;
    }

    return redirectPath;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setConfirmPassword("");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          email,
          password,
          ...(inviteToken ? { invite: inviteToken } : {}),
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        fields?: Record<string, string>;
        claimedGroups?: ClaimedGroupInfo[];
        inviteWarning?: string;
      };

      if (!response.ok) {
        if (data.fields) {
          setFieldErrors(data.fields);
        }
        setError(data.error ?? "Unable to sign up.");
        setPassword("");
        setConfirmPassword("");
        return;
      }

      const claimedGroups = data.claimedGroups ?? [];
      if (claimedGroups.length > 0) {
        try {
          sessionStorage.setItem(
            "finvault:claimedGroups",
            JSON.stringify(claimedGroups),
          );
        } catch {
          // ignore quota / private mode
        }
      }
      if (data.inviteWarning) {
        try {
          sessionStorage.setItem(
            "finvault:inviteWarning",
            data.inviteWarning,
          );
        } catch {
          // ignore
        }
      }

      router.push(buildPostSignupPath(claimedGroups, data.inviteWarning));
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setPassword("");
      setConfirmPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {inviteToken ? (
        <div
          role="status"
          className="rounded-lg border border-[#d7e0f8] bg-[#f4f7fd] px-4 py-3 text-sm text-[#1a1d29]"
        >
          {inviteGroup
            ? `You're joining ${inviteGroup}. Create an account with the invited email.`
            : "You're signing up from a group invite. Use the invited email."}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-[#1a1d29]">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "name-error" : undefined}
          className="w-full rounded-lg border border-[#e4e7ee] px-3 py-2.5 text-base text-[#1a1d29] outline-none focus:border-[#2f5fdc] focus:ring-2 focus:ring-[#2f5fdc]/20"
        />
        {fieldErrors.name ? (
          <p id="name-error" className="mt-1 text-sm text-red-600">
            {fieldErrors.name}
          </p>
        ) : null}
      </div>

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
          onChange={(event) => {
            if (!emailLocked) {
              setEmail(event.target.value);
            }
          }}
          readOnly={emailLocked}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          className={`w-full rounded-lg border border-[#e4e7ee] px-3 py-2.5 text-base text-[#1a1d29] outline-none focus:border-[#2f5fdc] focus:ring-2 focus:ring-[#2f5fdc]/20 ${
            emailLocked ? "bg-[#f4f6fb] text-[#5a6072]" : ""
          }`}
        />
        {emailLocked ? (
          <p className="mt-1 text-xs text-[#5a6072]">
            Email is locked to this invite.
          </p>
        ) : null}
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
          autoComplete="new-password"
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

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1 block text-sm font-medium text-[#1a1d29]"
        >
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full rounded-lg border border-[#e4e7ee] px-3 py-2.5 text-base text-[#1a1d29] outline-none focus:border-[#2f5fdc] focus:ring-2 focus:ring-[#2f5fdc]/20"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#2f5fdc] px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-[#1e3fae] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Signing up…" : "Sign up"}
      </button>

      <p className="text-center text-sm text-[#5a6072]">
        Already have an account?{" "}
        <Link
          href={
            searchParams.get("next")
              ? `/login?next=${encodeURIComponent(searchParams.get("next")!)}`
              : "/login"
          }
          className="font-medium text-[#2f5fdc] hover:underline"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
