// apps/frontend/src/lib/auth/client-auth.ts

import type { AuthUser } from '../api/auth';
import { refreshAuth } from '../api/auth';
import { clearAuth as clearTokenAuth } from '../auth-storage';

const AUTH_STORAGE_KEY = 'anor_auth';

export interface StoredAuthPayload {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number; // 时间戳（毫秒）
  refreshTokenExpiresAt: number; // 时间戳（毫秒）
}

/**
 * 把登录 / 注册 / 刷新接口返回的数据，统一存进 localStorage.anor_auth
 */
export function saveAuthFromLoginResult(result: {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}) {
  if (typeof window === 'undefined') return;

  const now = Date.now();

  const payload: StoredAuthPayload = {
    user: result.user,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    accessTokenExpiresAt: now + result.expiresIn * 1000,
    refreshTokenExpiresAt: now + result.refreshExpiresIn * 1000,
  };

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
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
 * 清除登录信息（退出登录 / token 彻底失效时会用到）
 * 同时清理：
 * - anor_auth（新结构）
 * - anor_access_token / anor_refresh_token / anor_user（旧结构）
 */
export function clearAuthStorage() {
  // 先走统一的 token 清理逻辑（老的存储结构）
  clearTokenAuth();

  if (typeof window === 'undefined') return;

  // 再把 anor_auth 也清掉
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * 如果 accessToken 即将过期，则用 refreshToken 自动刷新；
 * 刷新失败或 refresh 也过期，则返回 null（需要重新登录）。
 *
 * “滑动过期”策略：
 *  - accessToken 剩余时间 > THRESHOLD：直接用旧的
 *  - accessToken 快过期且 refresh 还有效：调 /auth/refresh 换一对新的
 *  - refresh 也过期：认为登录彻底失效
 */
const ACCESS_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 剩余 < 5 分钟就尝试刷新

export async function ensureFreshAuth(): Promise<StoredAuthPayload | null> {
  if (typeof window === 'undefined') return null;

  const auth = getStoredAuth();
  if (!auth) return null;

  const now = Date.now();

  // accessToken 还够“新”，直接用
  if (auth.accessTokenExpiresAt - now > ACCESS_REFRESH_THRESHOLD_MS) {
    return auth;
  }

  // refreshToken 也过期了，彻底失效
  if (auth.refreshTokenExpiresAt <= now) {
    clearAuthStorage();
    return null;
  }

  // 尝试用 refreshToken 换一对新的
  try {
    const result = await refreshAuth(auth.refreshToken);
    saveAuthFromLoginResult(result);
    return getStoredAuth();
  } catch {
    // 刷新失败，视为未登录
    clearAuthStorage();
    return null;
  }
}
