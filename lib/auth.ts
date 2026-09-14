import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  type AuthPayload,
  getAuthCookieOptions,
  signToken,
  verifyToken,
} from "@/lib/jwt";

export { AUTH_COOKIE_NAME } from "@/lib/jwt";
export type { AuthPayload } from "@/lib/jwt";
export { signToken, verifyToken } from "@/lib/jwt";

const BCRYPT_ROUNDS = 12;

function getCookieOptions() {
  return getAuthCookieOptions();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function getTokenFromRequest(
  request: NextRequest,
): Promise<string | undefined> {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value;
}

export async function requireAuth(
  request: NextRequest,
): Promise<AuthPayload | NextResponse> {
  const token = await getTokenFromRequest(request);

  if (!token) {
    return unauthorizedResponse();
  }

  try {
    return await verifyToken(token);
  } catch {
    return unauthorizedResponse();
  }
}

export function attachAuthCookie(
  response: NextResponse,
  token: string,
): NextResponse {
  response.cookies.set(AUTH_COOKIE_NAME, token, getCookieOptions());
  return response;
}

export function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...getCookieOptions(),
    maxAge: 0,
  });
  return response;
}

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, getCookieOptions());
}

export async function clearAuthCookieStore(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", {
    ...getCookieOptions(),
    maxAge: 0,
  });
}

