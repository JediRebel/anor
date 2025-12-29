// apps/frontend/src/lib/api/auth.ts

// NOTE:
//
// This module keeps the same exported names to avoid breaking imports,
// but token-based fields/functions have been removed under cookie auth.

// 后端返回的 user 结构（根据当前后端的 User 字段）
export type FrontendUserRole = 'guest' | 'user' | 'paid_user' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  role: FrontendUserRole;
}

// 对应后端登录 / 注册返回结构（cookie 模式下前端只关心 user）
export interface AuthResponse {
  user: AuthUser;
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
 * 注意：用 || 而不是 ??，避免 env 存在但为空字符串导致 baseUrl 变成 ''（请求会打到前端域名）
 */
export function getApiBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  if (envUrl) return envUrl.replace(/\/+$/, '');

  // 开发阶段的回退地址
  return 'http://localhost:3001';
}

function buildApiError(res: Response, message: string, body: unknown) {
  const error: any = new Error(message);
  error.status = res.status;
  error.data = body;
  return error;
}

async function parseErrorBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    try {
      return await res.text();
    } catch {
      return null;
    }
  }
}

function pickMessage(body: any, fallback: string): string {
  // 后端常见：{ message: string } 或 { message: string[] }
  if (Array.isArray(body?.message) && body.message.length > 0) {
    return body.message.join('，');
  }
  if (typeof body?.message === 'string' && body.message.trim()) {
    return body.message.trim();
  }
  if (typeof body === 'string' && body.trim()) {
    return body.trim();
  }
  return fallback;
}

/**
 * 登录：调用后端 /auth/login
 * Cookie auth 模式下，后端通过 Set-Cookie 写入 httpOnly cookie。
 */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const baseUrl = getApiBaseUrl();

  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify({
      email: payload.email.trim(),
      password: payload.password,
    }),
  });

  if (!res.ok) {
    const body = await parseErrorBody(res);
    const message = pickMessage(body as any, '登录失败，请稍后重试。');
    throw buildApiError(res, message, body);
  }

  // 兼容：后端仍可能返回 token 字段，但前端不应依赖。
  return (await res.json()) as AuthResponse;
}

/**
 * 注册：调用后端 /auth/register
 * 目前实现的是“注册即登录”，返回结构和 login 一样（cookie 已由后端写入）。
 */
export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const baseUrl = getApiBaseUrl();

  const res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify({
      email: payload.email.trim(),
      password: payload.password,
    }),
  });

  if (!res.ok) {
    const body = await parseErrorBody(res);
    const message = pickMessage(body as any, '注册失败，请稍后重试。');
    throw buildApiError(res, message, body);
  }

  return (await res.json()) as AuthResponse;
}

/**
 * Cookie 模式：从后端获取当前登录用户信息 (/auth/me)
 * - 必须携带 credentials: 'include'
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const baseUrl = getApiBaseUrl();

  const res = await fetch(`${baseUrl}/auth/me`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await parseErrorBody(res);
    const message = pickMessage(body as any, '获取当前用户信息失败');
    throw buildApiError(res, message, body);
  }

  return (await res.json()) as AuthUser;
}

/**
 * 登出：调用后端 /auth/logout 清理 httpOnly cookie。
 *（返回结构不强约束，调用方通常只关心成功/失败）
 */
export async function logout(): Promise<boolean> {
  const baseUrl = getApiBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });

    // 即使 401，也视为“已登出/会话无效”
    return res.ok || res.status === 401;
  } catch {
    // 网络错误时，调用方可继续做本地清理
    return false;
  }
}
