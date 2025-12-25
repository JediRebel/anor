// apps/frontend/src/app/me/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import type { AuthUser } from '@/lib/api/auth';
import { getCurrentUser } from '@/lib/api/auth';
import { ensureFreshAuth, clearAuthStorage, getStoredAuth } from '@/lib/auth/client-auth';

type MeState =
  | { status: 'loading' }
  | { status: 'not-logged-in' }
  | { status: 'error'; message: string }
  | { status: 'ready'; user: AuthUser };

export default function MePage() {
  const [state, setState] = useState<MeState>({ status: 'loading' });
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      // 先看本地有没有登录痕迹
      const existedAuth = getStoredAuth();

      // 从来没登录过，或者本地完全没有 token 记录
      if (!existedAuth?.accessToken) {
        if (!cancelled) {
          setState({ status: 'not-logged-in' });
        }
        return;
      }

      // 1）确保本地 auth 是“新鲜的”（必要时用 refreshToken 自动刷新）
      const freshAuth = await ensureFreshAuth();

      // 有过登录记录，但 token 已无法刷新
      if (!freshAuth) {
        if (!cancelled) {
          clearAuthStorage();
          setState({
            status: 'error',
            message: '当前登录状态已失效，请重新登录后再访问此页面。',
          });
        }
        return;
      }

      try {
        // 2）用最新的 accessToken 调 /auth/me
        const user = await getCurrentUser(freshAuth.accessToken);
        if (!cancelled) {
          setState({ status: 'ready', user });
        }
      } catch (err: any) {
        if (cancelled) return;

        const status: number | undefined = err?.status ?? err?.response?.status;

        // 后端返回 401 / 403：统一认为登录已失效
        if (status === 401 || status === 403) {
          clearAuthStorage();
          setState({
            status: 'error',
            message: '当前登录状态已过期，请重新登录后再访问此页面。',
          });
        } else {
          const raw = err instanceof Error && err.message ? err.message : '获取当前用户信息失败';
          setState({
            status: 'error',
            message: `加载失败：${raw}`,
          });
        }
      }
    }

    loadMe();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    clearAuthStorage();
    setState({ status: 'not-logged-in' });
    router.push('/login');
  };

  // =========================
  // 管理员视图：小型控制台
  // =========================
  if (state.status === 'ready' && state.user.role === 'admin') {
    const { user } = state;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">管理员控制台</h1>
              <p className="mt-1 text-xs text-slate-500">
                当前账号：{user.email}（ID: {user.id}）
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              退出登录
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded border border-slate-200 bg-slate-50/80 p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">文章管理</h2>
              <p className="mb-3 text-xs text-slate-500">
                管理网站上的公开文章，包括草稿、已发布内容和置顶顺序。
              </p>
              <div className="space-x-2 text-xs">
                <Link
                  href="/articles/admin"
                  className="inline-block rounded bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
                >
                  文章列表
                </Link>
                <Link
                  href="/articles/admin/new"
                  className="inline-block rounded border border-blue-200 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50"
                >
                  新建文章
                </Link>
              </div>
            </section>

            <section className="rounded border border-slate-200 bg-slate-50/80 p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">其他管理功能</h2>
              <p className="mb-3 text-xs text-slate-500">
                这里预留了其他后台入口。当前按钮只是占位，后续实现对应页面后即可直接跳转。
              </p>

              <div className="space-y-2 text-xs">
                <div className="space-x-2">
                  <Link
                    href="/admin/courses"
                    className="inline-block rounded border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                  >
                    课程管理（占位）
                  </Link>
                  <Link
                    href="/admin/users"
                    className="inline-block rounded border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                  >
                    用户管理（占位）
                  </Link>
                </div>
                <div className="space-x-2">
                  <Link
                    href="/admin/reports"
                    className="inline-block rounded border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                  >
                    数据报表（占位）
                  </Link>
                  <Link
                    href="/admin/settings"
                    className="inline-block rounded border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                  >
                    系统设置（占位）
                  </Link>
                </div>
              </div>

              <p className="mt-3 text-[11px] text-slate-400">
                提示：这些入口当前只是占位符，点击后可能进入 404
                页面。等将来对应模块开发完成，只需要在这些地址下实现实际页面即可。
              </p>
            </section>
          </div>

          <div className="mt-6 border-t pt-4 text-right text-[11px] text-slate-400">
            提示：如果你只是想以普通用户身份体验前台页面，可以使用非管理员账号登录。
          </div>
        </div>
      </div>
    );
  }

  // =========================
  // 普通用户 / 未登录视图
  // =========================
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow">
        <h1 className="mb-4 text-center text-2xl font-semibold">当前登录用户</h1>

        {state.status === 'loading' && (
          <p className="text-center text-sm text-slate-600">加载中…</p>
        )}

        {state.status === 'not-logged-in' && (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            当前未登录或登录状态已失效，请先前往{' '}
            <Link href="/login" className="font-semibold underline underline-offset-2">
              登录页面
            </Link>{' '}
            重新登录。
          </div>
        )}

        {state.status === 'error' && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {state.message}
            <div className="mt-2">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-xs font-medium text-blue-700 underline underline-offset-2"
              >
                前往登录页面
              </button>
            </div>
          </div>
        )}

        {state.status === 'ready' && state.user.role !== 'admin' && (
          <div className="space-y-4 text-sm text-slate-800">
            <div className="space-y-2">
              <div>
                <span className="font-medium">用户 ID：</span>
                {state.user.id}
              </div>
              <div>
                <span className="font-medium">邮箱：</span>
                {state.user.email}
              </div>
              <div>
                <span className="font-medium">角色：</span>
                {state.user.role}
              </div>
            </div>

            <div className="rounded border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
              这里未来可以扩展为「个人中心」：展示已购课程、预约记录、个人资料编辑等功能。
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 rounded border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              退出登录
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
