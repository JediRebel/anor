// apps/frontend/src/app/me/page.tsx

'use client';

import { useEffect, useState } from 'react';
import type { AuthUser } from '../../lib/api/auth';
import { getCurrentUser } from '../../lib/api/auth';
import { useRouter } from 'next/navigation';
import { getStoredAuth, clearAuthStorage } from '../../lib/auth/client-auth';

type MeState =
  | { status: 'loading' }
  | { status: 'not-logged-in' }
  | { status: 'error'; message: string }
  | { status: 'ready'; user: AuthUser };

export default function MePage() {
  const [state, setState] = useState<MeState>({ status: 'loading' });
  const router = useRouter();

  useEffect(() => {
    const auth = getStoredAuth();

    if (!auth?.accessToken) {
      setState({ status: 'not-logged-in' });
      return;
    }

    // 有 token，则请求后端获取当前用户
    getCurrentUser(auth.accessToken)
      .then((user) => {
        setState({ status: 'ready', user });
      })
      .catch((err) => {
        console.error(err);
        setState({
          status: 'error',
          message:
            err instanceof Error ? err.message : '获取当前用户信息失败',
        });
      });
  }, []);

  const handleLogout = () => {
    clearAuthStorage();
    setState({ status: 'not-logged-in' });
    router.push('/auth/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow">
        <h1 className="mb-4 text-center text-2xl font-semibold">
          当前登录用户
        </h1>

        {state.status === 'loading' && (
          <p className="text-center text-sm text-slate-600">加载中…</p>
        )}

        {state.status === 'not-logged-in' && (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            当前未登录，请先前往 <span className="font-semibold">登录页面</span>{' '}
            完成登录。
          </div>
        )}

        {state.status === 'error' && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            加载失败：{state.message}
          </div>
        )}

        {state.status === 'ready' && (
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

            <button
              type="button"
              onClick={handleLogout}
              className="rounded border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              退出登录
            </button>
          </div>
        )}
      </div>
    </div>
  );
}