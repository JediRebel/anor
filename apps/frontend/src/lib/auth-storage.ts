// apps/frontend/src/lib/auth-storage.ts

export type AuthUser = {
  id: number;
  email: string;
  role: string; // 'admin' | 'user' | 以后可能还有别的
};

export interface StoredAuth {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt?: number; // 先预留，将来需要可以填
  refreshTokenExpiresAt?: number; // 先预留，将来需要可以填
}

// 以后只用这一个 key 存所有登录信息
const AUTH_KEY = 'anor_auth';

/**
 * 保存登录信息到 localStorage
 * - data 至少要包含 user / accessToken / refreshToken
 */
export function saveAuth(data: StoredAuth) {
  if (typeof window === 'undefined') return;

  const payload: StoredAuth = {
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    accessTokenExpiresAt: data.accessTokenExpiresAt,
    refreshTokenExpiresAt: data.refreshTokenExpiresAt,
  };

  window.localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
}

/**
 * 读取完整的登录信息（可能为 null）
 */
export function getAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(AUTH_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredAuth;

    if (!parsed.user || !parsed.accessToken) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * 读取当前 access token
 */
export function getAccessToken(): string | null {
  const auth = getAuth();
  return auth?.accessToken ?? null;
}

/**
 * 读取当前登录用户信息
 */
export function getCurrentUser(): AuthUser | null {
  const auth = getAuth();
  return auth?.user ?? null;
}

/**
 * 是否“看起来已登录”（这里只看本地有没有 token，不判断是否过期）
 */
export function isAuthenticated(): boolean {
  const auth = getAuth();
  return !!auth?.accessToken;
}

/**
 * 退出登录：清空本地所有登录信息
 */
export function clearAuth() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_KEY);
}
