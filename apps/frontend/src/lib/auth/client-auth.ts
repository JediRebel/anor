// apps/frontend/src/lib/auth/client-auth.ts

import type { AuthUser } from '../api/auth';

const AUTH_STORAGE_KEY = 'anor_auth';

export interface StoredAuthPayload {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;  // 时间戳（毫秒）
  refreshTokenExpiresAt: number; // 时间戳（毫秒）
}

/**
 * 从 localStorage 读取当前登录信息
 */
export function getStoredAuth(): StoredAuthPayload | null {
  if (typeof window === 'undefined') {
    // 只在浏览器端可用
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredAuthPayload;

    // 简单校验字段是否存在
    if (!parsed.user || !parsed.accessToken) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * 当前是否“看起来”已登录（不检查 token 是否过期）
 */
export function isAuthenticated(): boolean {
  const auth = getStoredAuth();
  return !!auth?.accessToken;
}

/**
 * 清除登录信息（退出登录时会用到）
 */
export function clearAuthStorage() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}