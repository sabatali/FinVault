import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log in — FinVault",
};

function LoginFormFallback() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 rounded-lg bg-[#e4e7ee]" />
      <div className="h-10 rounded-lg bg-[#e4e7ee]" />
      <div className="h-11 rounded-lg bg-[#e4e7ee]" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-[#1a1d29]">Log in</h2>
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
