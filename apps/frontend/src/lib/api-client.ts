// apps/frontend/src/lib/api-client.ts

// 优先使用环境变量作为后端基础地址
// 你可以在 .env.local 里配置：NEXT_PUBLIC_API_BASE_URL
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export interface ApiError extends Error {
  status?: number;
  data?: unknown;
}

/**
 * 统一封装的请求函数
 */
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = new URL(path, API_BASE_URL).toString();

  const res = await fetch(url, {
    // 这里后面可以统一加上 Authorization 等
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const error: ApiError = new Error(
      (data as any)?.message || `Request failed with status ${res.status}`
    );
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export const apiClient = {
  get<T>(path: string, init?: RequestInit) {
    return request<T>(path, {
      method: "GET",
      ...init,
    });
  },

  post<T>(path: string, body?: unknown, init?: RequestInit) {
    return request<T>(path, {
      method: "POST",
      body: body != null ? JSON.stringify(body) : undefined,
      ...init,
    });
  },

  put<T>(path: string, body?: unknown, init?: RequestInit) {
    return request<T>(path, {
      method: "PUT",
      body: body != null ? JSON.stringify(body) : undefined,
      ...init,
    });
  },

  delete<T>(path: string, init?: RequestInit) {
    return request<T>(path, {
      method: "DELETE",
      ...init,
    });
  },
};