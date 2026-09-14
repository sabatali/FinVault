import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/jwt";

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const auth = await verifyToken(token);
    return auth.userId;
  } catch {
    return null;
  }
}
