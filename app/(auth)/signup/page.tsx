import type { Metadata } from "next";
import { Suspense } from "react";

import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Sign up — FinVault",
};

function SignupFormFallback() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 rounded-lg bg-[#e4e7ee]" />
      <div className="h-10 rounded-lg bg-[#e4e7ee]" />
      <div className="h-10 rounded-lg bg-[#e4e7ee]" />
      <div className="h-10 rounded-lg bg-[#e4e7ee]" />
      <div className="h-11 rounded-lg bg-[#e4e7ee]" />
    </div>
  );
}

export default function SignupPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-[#1a1d29]">Create account</h2>
      <Suspense fallback={<SignupFormFallback />}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
