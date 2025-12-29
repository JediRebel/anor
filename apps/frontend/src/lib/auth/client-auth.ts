// apps/frontend/src/lib/auth/client-auth.ts

import type { AuthUser } from '../api/auth';

// NOTE:
// Auth uses httpOnly-cookie session auth.
// The browser should not persist or manage any credentials client-side.
// The source of truth for session state is GET /auth/me.

// 注意：用 || 而不是 ??，避免 env 存在但为空字符串导致 baseUrl 变成 ''（请求会打到前端域名）
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

/**
 * Minimal session payload under cookie auth.
 * Kept as a small shared type for client code.
 */
export interface SessionPayload {
  user: AuthUser;
  mode: 'cookie';
}

/**
 * Cookie session source of truth: GET /auth/me
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      // 登录的时候为什么要访问这个页面？取消这个访问可以吗？
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    if (!res.ok) return null;
    return (await res.json()) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Legacy: token storage is not used.
 */
export function getStoredAuth(): null {
  return null;
}

/**
 * Legacy: synchronous auth check is not possible with httpOnly cookies.
 * Use `getSessionUser()` instead.
 */
export function isAuthenticated(): boolean {
  return false;
}

/**
 * Compatibility helper.
 * Verifies cookie session by calling /auth/me.
 */
export async function ensureFreshAuth(): Promise<SessionPayload | null> {
  if (typeof window === 'undefined') return null;

  const user = await getSessionUser();
  if (!user) return null;

  return {
    user,
    mode: 'cookie',
  };
}

/**
 * Convenience helper for admin gating in client pages.
 */
export async function isAdminSession(): Promise<boolean> {
  const user = await getSessionUser();
  return !!user && user.role === 'admin';
}

/**
 * Logs out the current session.
 * Backend clears httpOnly cookies via POST /auth/logout.
 */
export async function logout(): Promise<boolean> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // ignore network errors
  }

  return true;
}
