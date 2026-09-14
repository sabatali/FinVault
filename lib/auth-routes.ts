export const PUBLIC_PAGE_PATHS = ["/", "/login", "/signup"] as const;

export const PUBLIC_API_PATHS = [
  "/api/health",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/logout",
] as const;

export const AUTH_PAGE_PATHS = ["/login", "/signup"] as const;

export function isPublicPagePath(pathname: string): boolean {
  if ((PUBLIC_PAGE_PATHS as readonly string[]).includes(pathname)) {
    return true;
  }
  return pathname.startsWith("/invite/");
}

export function isPublicApiPath(pathname: string): boolean {
  if ((PUBLIC_API_PATHS as readonly string[]).includes(pathname)) {
    return true;
  }
  return pathname.startsWith("/api/invites/");
}

export function isAuthPagePath(pathname: string): boolean {
  return (AUTH_PAGE_PATHS as readonly string[]).includes(pathname);
}

/**
 * Validates `next` redirect targets to prevent open redirects.
 * Only allows same-origin relative paths.
 */
export function getSafeRedirectPath(next: string | null | undefined): string {
  const fallback = "/dashboard";

  if (!next) {
    return fallback;
  }

  const trimmed = next.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  if (trimmed.includes("://")) {
    return fallback;
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("/javascript:") || lower.startsWith("/data:")) {
    return fallback;
  }

  return trimmed;
}

export function buildLoginUrl(requestUrl: string, returnPath: string): URL {
  const loginUrl = new URL("/login", requestUrl);
  loginUrl.searchParams.set("next", returnPath);
  return loginUrl;
}
