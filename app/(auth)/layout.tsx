export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-[#f9fafc] px-4 py-12">
      <div className="w-full max-w-[440px] rounded-xl border border-[#e4e7ee] bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-extrabold text-[#1a1d29]">FinVault</h1>
          <p className="mt-1 text-sm text-[#5a6072]">
            Personal and group finance, one ledger.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
