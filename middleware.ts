import { NextRequest, NextResponse } from "next/server";

import {
  buildLoginUrl,
  isAuthPagePath,
  isPublicApiPath,
  isPublicPagePath,
} from "@/lib/auth-routes";
import {
  AUTH_COOKIE_NAME,
  getClearCookieOptions,
  verifyToken,
} from "@/lib/jwt";

async function hasValidSession(token: string | undefined): Promise<boolean> {
  if (!token) {
    return false;
  }

  try {
    await verifyToken(token);
    return true;
  } catch {
    return false;
  }
}

function clearAuthCookieOnResponse(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_COOKIE_NAME, "", getClearCookieOptions());
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthenticated = await hasValidSession(token);

  if (pathname.startsWith("/api")) {
    if (isPublicApiPath(pathname)) {
      return NextResponse.next();
    }

    if (!isAuthenticated) {
      const response = NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
      if (token) {
        return clearAuthCookieOnResponse(response);
      }
      return response;
    }

    return NextResponse.next();
  }

  if (isAuthPagePath(pathname)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (isPublicPagePath(pathname)) {
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    const loginUrl = buildLoginUrl(request.url, pathname);
    const response = NextResponse.redirect(loginUrl);
    if (token) {
      return clearAuthCookieOnResponse(response);
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
