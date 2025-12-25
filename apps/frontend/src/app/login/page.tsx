// apps/frontend/src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import type { AuthUser } from '@/lib/api/auth';
import { saveAuthFromLoginResult } from '@/lib/auth/client-auth';

type LoginResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('admin@anorvisa.com');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('请输入邮箱和密码');
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiClient.post<LoginResponse>('/auth/login', {
        email: email.trim(),
        password,
      });

      // 把登录结果统一写入 localStorage.anor_auth
      saveAuthFromLoginResult(result);

      // 如果 URL 中带有 redirect 参数（例如 /login?redirect=/articles/admin/new），
      // 则优先跳回该地址；
      // 否则根据角色采用默认跳转策略：
      // - admin → 后台文章列表
      // - 其他角色 → 个人中心（后面可以再扩展）
      const redirect = searchParams.get('redirect');

      if (redirect && redirect.startsWith('/')) {
        router.push(redirect);
      } else if (result.user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/me');
      }
    } catch (err) {
      const apiErr = err as ApiError;

      let msg = '登录失败，请稍后重试。';

      if (apiErr?.status === 401) {
        // 账号或密码错误
        msg = '账号与密码不匹配，请重新输入正确的账号及密码';
      } else if (typeof apiErr?.message === 'string' && apiErr.message.trim()) {
        // 其他业务错误，尽量直接展示后端 message
        msg = apiErr.message.trim();
      }

      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow">
        <h1 className="mb-6 text-center text-2xl font-semibold">登录 Anor 账号</h1>

        {errorMsg && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">邮箱</label>
            <input
              type="email"
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">密码</label>
            <input
              type="password"
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? '登录中…' : '登录'}
          </button>
        </form>

        {/* 原来的“仅支持管理员登录”提示删除 */}
        <p className="mt-4 text-center text-xs text-slate-500">
          还没有账号？请先前往{' '}
          <a href="/register" className="text-blue-600 underline underline-offset-2">
            注册页面
          </a>
          创建新账号。
        </p>
      </div>
    </main>
  );
}
