import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CurrencyProvider } from "@/components/currency/CurrencyProvider";
import { AppShell } from "@/components/layout/AppShell";
import { connectDB } from "@/lib/db";
import { getFxSnapshot, normalizeDisplayCurrency } from "@/lib/fx";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/jwt";
import { toAppShellUser } from "@/lib/navigation";
import { toUserPublic, User } from "@/models/User";

async function getLayoutUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  try {
    const auth = await verifyToken(token);
    await connectDB();
    const user = await User.findById(auth.userId);

    if (!user) {
      redirect("/login");
    }

    return user;
  } catch {
    redirect("/login");
  }
}

export default async function AuthenticatedLayout({
  children,
}: LayoutProps<"/">) {
  const user = await getLayoutUser();
  const fx = getFxSnapshot();
  const preferredCurrency = normalizeDisplayCurrency(user.preferredCurrency);

  return (
    <CurrencyProvider
      preferredCurrency={preferredCurrency}
      rates={fx.rates}
      asOf={fx.asOf}
    >
      <AppShell user={toAppShellUser(toUserPublic(user))}>{children}</AppShell>
    </CurrencyProvider>
  );
}
