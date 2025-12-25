// apps/frontend/src/lib/api-client.ts

import { clearAuthStorage } from './auth/client-auth';

// 优先使用环境变量作为后端基础地址
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export interface ApiError extends Error {
  status?: number;
  data?: unknown;
}

/** 从 localStorage 读取 access token（仅在浏览器端可用） */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    // ✅ 现在统一从 anor_auth 里读取
    const raw = window.localStorage.getItem('anor_auth');
    if (raw) {
      const parsed = JSON.parse(raw) as {
        accessToken?: string;
        accessTokenExpiresAt?: number;
      };

      if (parsed.accessToken) {
        // 如果带了过期时间，顺便做一下简单检查（不过期才用）
        if (!parsed.accessTokenExpiresAt || parsed.accessTokenExpiresAt > Date.now()) {
          return parsed.accessToken;
        }
      }
    }

    // 🔙 兼容旧版本：如果以后本地还有 anor_access_token，就当兜底
    const legacy = window.localStorage.getItem('anor_access_token');
    if (legacy) return legacy;

    return null;
  } catch {
    return null;
  }
}

/**
 * 统一封装的请求函数
 * - 自动加 Content-Type
 * - 自动加 Authorization: Bearer <token>（除非调用方已经传了）
 * - 5xx 打 error 日志，4xx 打 warn
 * - 401 时自动清理本地登录信息
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = new URL(path, API_BASE_URL).toString();
  const method = (options.method ?? 'GET').toUpperCase();

  // 基础 headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };

  // 🔑 如果调用方没有自己传 Authorization，再自动补 JWT
  const hasAuthHeader =
    (headers as any).Authorization != null || (headers as any).authorization != null;

  if (!hasAuthHeader) {
    const token = getAccessToken();
    if (token) {
      (headers as any).Authorization = `Bearer ${token}`;
    }
  }

  const finalOptions: RequestInit = {
    ...options,
    method,
    headers,
  };

  // 开发环境简单记录请求
  if (process.env.NODE_ENV !== 'production') {
    console.log('[apiClient] Request', {
      url,
      method,
      headers,
      body: finalOptions.body,
    });
  }

  let res: Response;
  try {
    res = await fetch(url, finalOptions);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[apiClient] Network error', { url, method, err });
    }
    const error: ApiError = new Error('网络请求失败，请稍后重试。');
    throw error;
  }

  const text = await res.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    let messageFromServer =
      (data as any)?.message ||
      (typeof data === 'string' ? data : '') ||
      `请求失败，状态码：${res.status}`;

    const error: ApiError = new Error(messageFromServer);
    error.status = res.status;
    error.data = data;

    // 401：登录状态失效，顺带清理本地存储
    if (res.status === 401) {
      clearAuthStorage();
      // 尽量使用后端返回的提示文案，统一风格；没有时才用兜底文案
      const backendMsg = (data as any)?.message;
      error.message = backendMsg || '当前登录状态已失效，请重新登录。';
    }

    if (process.env.NODE_ENV !== 'production') {
      const logPayload = { url, method, status: res.status, data };
      if (res.status >= 500) {
        console.error('[apiClient] Request failed (server error)', logPayload);
      } else {
        console.warn('[apiClient] Request failed (client / business error)', logPayload);
      }
    }

    throw error;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[apiClient] Response OK', {
      url,
      method,
      data,
    });
  }

  return data as T;
}

export const apiClient = {
  get<T>(path: string, init?: RequestInit) {
    return request<T>(path, {
      method: 'GET',
      cache: 'no-store', // 开发阶段默认禁用 GET 缓存
      ...init,
    });
  },

  post<T>(path: string, body?: unknown, init?: RequestInit) {
    return request<T>(path, {
      method: 'POST',
      body: body != null ? JSON.stringify(body) : undefined,
      ...init,
    });
  },

  put<T>(path: string, body?: unknown, init?: RequestInit) {
    return request<T>(path, {
      method: 'PUT',
      body: body != null ? JSON.stringify(body) : undefined,
      ...init,
    });
  },

  delete<T>(path: string, init?: RequestInit) {
    return request<T>(path, {
      method: 'DELETE',
      ...init,
    });
  },
};
