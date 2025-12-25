// apps/frontend/src/lib/api/auth.ts

// 后端返回的 user 结构（根据当前后端的 User 字段）
export type FrontendUserRole = 'guest' | 'user' | 'paid_user' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  role: FrontendUserRole;
}

// 和后端登录 / 注册 / 刷新 返回结构对应
export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access token 有效期（秒）
  refreshExpiresIn: number; // refresh token 有效期（秒）
}

// 方便其它地方统一命名
export type AuthResult = AuthResponse;

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
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
  // 开发阶段的回退地址
  return 'http://localhost:3001';
}

/**
 * 登录：调用后端 /auth/login
 * 注意：这是“业务登录”的接口，不是 Next.js 自己的 /login 路由页面。
 */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const baseUrl = getApiBaseUrl();

  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      email: payload.email.trim(),
      password: payload.password,
    }),
  });

  // 后端错误格式一般是 { success: false, statusCode, message, ... }
  if (!res.ok) {
    let message = '登录失败，请稍后重试。';
    let body: any = null;

    try {
      body = (await res.json()) as any;
      if (typeof body?.message === 'string') {
        message = body.message;
      }
    } catch {
      // ignore parse error
    }

    const error: any = new Error(message);
    error.status = res.status;
    error.data = body;
    throw error;
  }

  const data = (await res.json()) as AuthResponse;
  return data;
}

/**
 * 注册：调用后端 /auth/register
 * 目前实现的是“注册即登录”，返回结构和 login 一样。
 */
export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const baseUrl = getApiBaseUrl();

  const res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      email: payload.email.trim(),
      password: payload.password,
    }),
  });

  if (!res.ok) {
    let message = '注册失败，请稍后重试。';
    let body: any = null;

    try {
      body = (await res.json()) as any;

      // 如果后端用 class-validator，通常是 message: string[]
      if (Array.isArray(body?.message) && body.message.length > 0) {
        message = body.message.join('，');
      } else if (typeof body?.message === 'string') {
        message = body.message;
      }
    } catch {
      // ignore parse error
    }

    const error: any = new Error(message);
    error.status = res.status;
    error.data = body;
    throw error;
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
    let message = '获取当前用户信息失败';
    let body: any = null;

    try {
      body = (await res.json()) as any;
      if (typeof body?.message === 'string') {
        message = body.message;
      }
    } catch {
      // ignore parse error
    }

    const error: any = new Error(message);
    error.status = res.status;
    error.data = body;
    throw error;
  }

  const data = (await res.json()) as AuthUser;
  return data;
}

/**
 * 使用 refreshToken 调用后端 /auth/refresh，获取新的 access/refresh token
 * 用于“滑动过期”逻辑。
 */
export async function refreshAuth(refreshToken: string): Promise<AuthResponse> {
  const baseUrl = getApiBaseUrl();

  const res = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    let message = '刷新登录状态失败，请重新登录。';
    let body: any = null;

    try {
      body = (await res.json()) as any;
      if (typeof body?.message === 'string') {
        message = body.message;
      }
    } catch {
      // ignore
    }

    const error: any = new Error(message);
    error.status = res.status;
    error.data = body;
    throw error;
  }

  const data = (await res.json()) as AuthResponse;
  return data;
}
