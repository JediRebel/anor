// apps/frontend/src/lib/api-client.ts

// 注意：用 || 而不是 ??，避免 env 存在但为空字符串导致 API_BASE_URL 变成 ''（new URL 会抛错）
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

// 401 自动刷新策略：
// - access cookie (anor_at) 关闭浏览器会丢失；remember-me 场景下只剩 refresh cookie (anor_rt)
// - 当后端返回 401 时：尝试调用 /auth/refresh（利用 httpOnly refresh cookie）拿到新的 access cookie
// - 对幂等请求（GET/HEAD）自动重试一次；对非幂等请求不自动重试，避免重复提交
let refreshInFlight: Promise<boolean> | null = null;

function isAuthPath(path: string): boolean {
  // Avoid refresh loops for auth endpoints.
  return (
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/register') ||
    path.startsWith('/auth/refresh') ||
    path.startsWith('/auth/logout')
  );
}

async function refreshSessionCookies(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const url = new URL('/auth/refresh', API_BASE_URL).toString();
    try {
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
 * - 自动处理 Content-Type（仅在 JSON body 时设置）
 * - **强制**携带 httpOnly cookie（credentials: 'include'）
 * - 5xx 打 error 日志，4xx 打 warn
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = new URL(path, API_BASE_URL).toString();
  const method = String(options.method ?? 'GET').toUpperCase();

  // 关键：全站统一带 cookie（httpOnly cookie 方案必须）
  // 注意：这里是“强制 include”，不允许被调用方覆盖
  const finalOptions: RequestInit = {
    ...options,
    method,
    credentials: 'include',
  };

  // 统一处理 headers（避免直接用对象 spread 导致 Headers/大小写问题）
  const headers = new Headers(options.headers ?? undefined);

  // 仅在“看起来是 JSON body”时补 Content-Type。
  // 1) 若用户传的是 FormData/Blob/ArrayBuffer 等，不能手动设置 Content-Type（浏览器会自动加 boundary）
  // 2) 我们的 apiClient.post/put 默认会传 stringified JSON
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

  const doFetchOnce = async (): Promise<{ res: Response; data: unknown }> => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[apiClient] Request', {
        url,
        method,
        hasBody,
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

    const data = await parseBody(res);
    return { res, data };
  };

  // 1) 首次请求
  let { res, data } = await doFetchOnce();

  // 2) 401 处理：尝试 refresh cookie session，再对 GET/HEAD 重试一次
  if (res.status === 401 && !isAuthPath(path) && (method === 'GET' || method === 'HEAD')) {
    const refreshed = await refreshSessionCookies();
    if (refreshed) {
      ({ res, data } = await doFetchOnce());
    }
  }

  // 3) 统一错误处理
  if (!res.ok) {
    const error = buildApiError(res.status, data);

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
