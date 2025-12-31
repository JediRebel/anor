// apps/frontend/src/lib/api-client.ts

// 注意：用 || 而不是 ??，避免 env 存在但为空字符串导致 API_BASE_URL 变成 ''（new URL 会抛错）
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

// 全局单例锁，避免并发请求时同时发起多个 refresh 请求
let refreshInFlight: Promise<boolean> | null = null;

function isAuthPath(path: string): boolean {
  // 避免在这些接口本身 401 时死循环
  return (
    path.includes('/auth/login') ||
    path.includes('/auth/register') ||
    path.includes('/auth/refresh') ||
    path.includes('/auth/logout')
  );
}

/**
 * 尝试调用刷新接口
 * 利用 httpOnly 的 Refresh Token Cookie 换取新的 Access Token Cookie
 */
async function refreshSessionCookies(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      // 注意：这里必须用原生的 fetch，不能用封装后的 request，否则会递归死循环
      const url = new URL('/auth/refresh', API_BASE_URL).toString();
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export interface ApiError extends Error {
  status?: number;
  data?: unknown;
}

/**
 * 统一封装的请求函数
 * - 自动携带 httpOnly cookie
 * - **自动处理 401 Token 过期问题（滑动续期核心逻辑）**
 * - 统一错误处理
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = new URL(path, API_BASE_URL).toString();
  const method = String(options.method ?? 'GET').toUpperCase();

  const finalOptions: RequestInit = {
    ...options,
    method,
    credentials: 'include', // 强制携带 Cookie
  };

  const headers = new Headers(options.headers ?? undefined);

  // 自动设置 Content-Type: application/json
  const hasBody = finalOptions.body !== undefined && finalOptions.body !== null;
  const isStringBody = typeof finalOptions.body === 'string';
  if (hasBody && isStringBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  finalOptions.headers = headers;

  const parseBody = async (res: Response): Promise<unknown> => {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  };

  const buildApiError = (status: number, data: unknown): ApiError => {
    const messageFromServer =
      (data as any)?.message ||
      (typeof data === 'string' ? data : '') ||
      `请求失败，状态码：${status}`;

    const error: ApiError = new Error(messageFromServer);
    error.status = status;
    error.data = data;
    return error;
  };

  // 内部执行函数
  const doFetch = async (): Promise<{ res: Response; data: unknown }> => {
    let res: Response;
    try {
      res = await fetch(url, finalOptions);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[apiClient] Network error', { url, method, err });
      }
      throw new Error('网络请求失败，请检查网络连接。');
    }
    const data = await parseBody(res);
    return { res, data };
  };

  // --- 第 1 次尝试 ---
  let { res, data } = await doFetch();

  // --- 拦截 401 并尝试自动刷新 ---
  // 条件：状态码 401 + 不是 auth 相关接口
  if (res.status === 401 && !isAuthPath(path)) {
    // 尝试刷新 Token
    const refreshSuccess = await refreshSessionCookies();

    if (refreshSuccess) {
      // 刷新成功！重试原请求
      // console.log('[apiClient] 401 -> Refresh Success -> Retry');
      ({ res, data } = await doFetch());
    } else {
      // 刷新失败（RT 也过期了），保持原有的 401 错误，让上层业务逻辑处理（比如跳登录页）
      // console.warn('[apiClient] 401 -> Refresh Failed -> Throw Error');
    }
  }

  // --- 统一错误处理 ---
  if (!res.ok) {
    const error = buildApiError(res.status, data);

    // 只在非生产环境打印详细错误日志，避免污染控制台
    if (process.env.NODE_ENV !== 'production') {
      const logPayload = { url, method, status: res.status, data };
      if (res.status !== 401) {
        // 401 很常见，通常不视为系统级错误
        console.warn('[apiClient] Request failed', logPayload);
      }
    }

    throw error;
  }

  return data as T;
}

export const apiClient = {
  get<T>(path: string, init?: RequestInit) {
    return request<T>(path, {
      method: 'GET',
      cache: 'no-store',
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

  patch<T>(path: string, body?: unknown, init?: RequestInit) {
    return request<T>(path, {
      method: 'PATCH',
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
