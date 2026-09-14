import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[#f9fafc] px-6 py-16">
      <main className="w-full max-w-lg text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-[#1a1d29] sm:text-5xl">
          FinVault
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-[#5a6072]">
          Personal and group finance, one ledger.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#1a1d29] px-6 text-sm font-semibold text-white transition hover:bg-[#2a2f3d] sm:w-auto"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-[#e4e7ee] bg-white px-6 text-sm font-semibold text-[#1a1d29] transition hover:bg-[#f3f4f8] sm:w-auto"
          >
            Log in
          </Link>
        </div>
      </main>
    </div>
  );
}
