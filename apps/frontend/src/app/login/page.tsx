// apps/frontend/src/app/login/page.tsx
'use client';

import { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuth } from '@/components/auth-provider';
//  [新增] 引入 useAuth
import type { AuthUser } from '@/lib/api/auth';

type LoginResponse = {
  user: AuthUser;
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth(); // ✅ [新增] 获取刷新方法

  const [email, setEmail] = useState('admin@anorvisa.com');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const showPasswordChangedNotice =
    !noticeDismissed && searchParams.get('reason') === 'password-changed';

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
        rememberMe,
      });

      // ✅ [关键新增] 登录成功后，立即手动刷新全局 auth 状态
      // 这样导航栏会立即从“登录”变成“我的”
      await refresh();

      // 使用后端 Set-Cookie 写入 httpOnly cookie；前端不保存任何 token 或本地凭证。
      // 如果 URL 中带有 redirect 参数（例如 /login?redirect=/articles/admin/new），则优先跳回该地址；
      // 否则根据角色采用默认跳转策略：
      // - admin → 后台文章列表
      // - 其他角色 → 个人中心
      const redirect = searchParams.get('redirect');
      const defaultTarget = result?.user?.role === 'admin' ? '/articles/admin' : '/me';
      const target = redirect && redirect.startsWith('/') ? redirect : defaultTarget;

      // 跳转页面
      router.replace(target);

      // 确保导航发生后再触发 refresh，让 Server Components（RootLayout）重新读取 cookies。
      // 虽然前端 Context 已经更新了，但为了保险起见（特别是混合渲染模式下），保留这个 refresh 也是好的。
      setTimeout(() => {
        router.refresh();
      }, 0);
      return;
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

        {showPasswordChangedNotice && (
          <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">密码修改成功</div>
                <div className="mt-0.5">请重新登录后继续使用。</div>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                onClick={() => {
                  setNoticeDismissed(true);
                  passwordRef.current?.focus();
                }}
              >
                重新登录
              </button>
            </div>
          </div>
        )}

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
              ref={passwordRef}
              type="password"
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              记住我（7 天内本机免登录）
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          还没有账号？请先前往{' '}
          <Link href="/register" className="text-blue-600 underline underline-offset-2">
            注册页面
          </Link>
          创建新账号。
        </p>
      </div>
    </main>
  );
}
