// apps/frontend/src/lib/api/auth.ts

// 后端返回的 user 结构（根据当前后端的 User 字段）
export type UserRole = 'guest' | 'user' | 'paid_user' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

/**
 * 统一获取后端 API 基础地址。
 * 先尝试读取 NEXT_PUBLIC_API_BASE_URL，没有的话在开发环境回退到 http://localhost:3001
 */
export function getApiBaseUrl() {
  if (typeof process !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (envUrl) {
      return envUrl.replace(/\/+$/, ''); // 去掉尾部的斜杠
    }
  }
  // 开发阶段的回退地址（后面可以单独开一步改成环境变量方案）
  return 'http://localhost:3001';
}

/**
 * 调用后端 /auth/login
 */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const baseUrl = getApiBaseUrl();

  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // Next.js App Router 默认用的是 fetch，这里显式禁用缓存
    cache: 'no-store',
    body: JSON.stringify(payload),
  });

  // 后端现在的错误格式是 { success: false, statusCode, message, ... }
  if (!res.ok) {
    let message = 'Login failed';

    try {
      const data = (await res.json()) as any;
      if (typeof data?.message === 'string') {
        message = data.message;
      }
    } catch {
      // ignore parse error
    }

    throw new Error(message);
  }

  const data = (await res.json()) as AuthResponse;
  return data;
}

/**
 * 使用 accessToken 从后端获取当前登录用户信息 (/auth/me)
 */
export async function getCurrentUser(accessToken: string): Promise<AuthUser> {
  const baseUrl = getApiBaseUrl();

  const res = await fetch(`${baseUrl}/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let message = 'Failed to fetch current user';

    try {
      const data = (await res.json()) as any;
      if (typeof data?.message === 'string') {
        message = data.message;
      }
    } catch {
      // ignore parse error
    }

    throw new Error(message);
  }

  const data = (await res.json()) as AuthUser;
  return data;
}