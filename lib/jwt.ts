import { SignJWT, jwtVerify } from "jose";

export const AUTH_COOKIE_NAME = "finvault_token";

const DEFAULT_JWT_EXPIRES_IN = "7d";

export interface AuthPayload {
  userId: string;
  email: string;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }
  return new TextEncoder().encode(secret);
}

function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? DEFAULT_JWT_EXPIRES_IN;
}

export async function signToken(payload: AuthPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(getJwtExpiresIn())
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<AuthPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  const userId = payload.sub;

  if (!userId || typeof userId !== "string") {
    throw new Error("Invalid token payload");
  }

  const email = payload.email;
  if (!email || typeof email !== "string") {
    throw new Error("Invalid token payload");
  }

  return { userId, email };
}

export function getClearCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60,
  };
}
