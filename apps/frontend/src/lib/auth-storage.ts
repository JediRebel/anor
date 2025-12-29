// apps/frontend/src/lib/auth-storage.ts

export type AuthUser = {
  id: number;
  email: string;
  role: string; // 'admin' | 'user' | 以后可能还有别的
};

export interface StoredAuth {
  user: AuthUser;
  /**
   * Indicates this payload is derived from cookie session.
   * Kept only to avoid breaking old imports.
   */
  mode?: 'cookie';
}

// ================================
// NOTE:
// This project uses httpOnly-cookie session auth.
// The browser should not rely on any client-side credential storage.
// Cookie session (GET /auth/me with credentials) is the source of truth.
// ================================

// 注意：用 || 而不是 ??，避免 env 存在但为空字符串导致 baseUrl 变成 ''
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001').replace(
  /\/+$/,
  '',
);

/**
 * Legacy: previously persisted auth data on the client.
 * Disabled under cookie-session auth.
 */
export function saveAuth(_data: StoredAuth) {
  // no-op under cookie auth
  return;
}

/**
 * Legacy: previously read client-side auth data.
 * Disabled under cookie-session auth.
 */
export function getAuth(): StoredAuth | null {
  return null;
}

export function getCurrentUser(): AuthUser | null {
  return null;
}

/**
 * Legacy export retained for compatibility.
 * Not supported with httpOnly cookie sessions; always returns false.
 */
export function isAuthenticated(): boolean {
  return false;
}

/**
 * Legacy export retained for compatibility.
 * Under cookie-session auth, sign-out is performed via POST /auth/logout.
 */
export function clearAuth() {
  // no-op
  return;
}

/**
 * Source of truth: GET /auth/me (httpOnly-cookie session).
 * - returns null for not-logged-in / session invalid / request failed
 * - browser-side only
 */
export async function fetchCurrentUserFromCookie(): Promise<AuthUser | null> {
  if (typeof window === 'undefined') return null;

  const baseUrl = API_BASE;

  try {
    const res = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const data = (await res.json()) as any;
    if (!data || typeof data !== 'object') return null;

    const user: AuthUser = {
      id: typeof data.id === 'number' ? data.id : Number(data.id),
      email: String(data.email ?? ''),
      role: String(data.role ?? ''),
    };

    if (!user.id || !user.email) return null;

    return user;
  } catch {
    return null;
  }
}

/**
 * Based on cookie session: whether user is admin.
 */
export async function isAdminFromCookie(): Promise<boolean> {
  const user = await fetchCurrentUserFromCookie();
  return user?.role === 'admin';
}
