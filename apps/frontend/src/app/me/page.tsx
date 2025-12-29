// apps/frontend/src/app/me/page.tsx

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { getApiBaseUrl, type AuthUser } from '@/lib/api/auth';

type MyCourseListItemDto = {
  courseId: string;
  title: string;
  slug: string;
  summary: string | null;
  coverImageUrl: string | null;
  enrolledAt: string;
};

async function fetchCurrentUser(): Promise<AuthUser> {
  const baseUrl = getApiBaseUrl();

  const res = await fetch(`${baseUrl}/auth/me`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    const err: any = new Error('Failed to load /auth/me');
    err.status = res.status;
    throw err;
  }

  return (await res.json()) as AuthUser;
}

async function getMyCourses(): Promise<MyCourseListItemDto[]> {
  const baseUrl = getApiBaseUrl();

  const res = await fetch(`${baseUrl}/me/courses`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    const err: any = new Error('Failed to load /me/courses');
    err.status = res.status;
    throw err;
  }

  return (await res.json()) as MyCourseListItemDto[];
}

type MeState =
  | { status: 'loading' }
  | { status: 'not-logged-in' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      user: AuthUser;
      courses: MyCourseListItemDto[];
    };

type MeTabKey = 'articles' | 'courses' | 'appointments' | 'profile' | 'security';

export default function MePage() {
  const [state, setState] = useState<MeState>({ status: 'loading' });
  const [activeTab, setActiveTab] = useState<MeTabKey>('courses');
  const router = useRouter();

  // 账户安全：改密码（httpOnly cookie 鉴权，前端只负责提交表单）
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<null | {
    type: 'success' | 'error';
    text: string;
  }>(null);
  const [showPasswordChangedNotice, setShowPasswordChangedNotice] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      try {
        // httpOnly cookie 鉴权（当前方案）：只信 cookie，不使用前端本地令牌
        const user = await fetchCurrentUser();
        const courses = await getMyCourses();

        if (!cancelled) {
          setState({
            status: 'ready',
            user,
            courses,
          });
        }
      } catch (err: any) {
        if (cancelled) return;

        const status: number | undefined = err?.status ?? err?.response?.status;

        // 未登录或登录已失效
        if (status === 401 || status === 403) {
          setState({ status: 'not-logged-in' });
          router.replace('/login?redirect=/me');
          return;
        }

        const raw = err instanceof Error && err.message ? err.message : '获取当前用户信息失败';
        setState({
          status: 'error',
          message: `加载失败：${raw}`,
        });
      }
    }

    loadMe();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // 未登录或仍在加载时，不渲染任何内容（同时 useEffect 会负责跳转到 /login）
  if (state.status === 'loading' || state.status === 'not-logged-in') {
    return null;
  }

  const handleLogout = async () => {
    try {
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // 忽略错误：即便后端暂时不可用，也继续跳转到登录页
    } finally {
      // 退出后立刻跳转到登录页，并刷新一次以让 Server Components（导航栏）按最新 cookie 重新渲染
      setState({ status: 'not-logged-in' });
      router.replace('/login');
      router.refresh();
    }
  };

  const readApiErrorMessage = async (res: Response) => {
    try {
      const data = await res.json();
      const msg = (data as any)?.message;
      if (typeof msg === 'string' && msg.trim()) return msg.trim();
      if (Array.isArray(msg) && msg.length) return msg.join('; ');
      if (typeof (data as any)?.error === 'string' && (data as any).error.trim())
        return (data as any).error.trim();
    } catch {
      // ignore
    }
    return `请求失败（HTTP ${res.status}）`;
  };

  const handleChangePassword = async () => {
    if (changingPassword) return;

    setPasswordMessage(null);
    setShowPasswordChangedNotice(false);

    const cur = currentPassword.trim();
    const next = newPassword.trim();
    const confirm = confirmNewPassword.trim();

    if (!cur || !next || !confirm) {
      setPasswordMessage({ type: 'error', text: '请完整填写当前密码与新密码。' });
      return;
    }

    if (next.length < 8) {
      setPasswordMessage({ type: 'error', text: '新密码长度至少 8 位。' });
      return;
    }

    if (next !== confirm) {
      setPasswordMessage({ type: 'error', text: '两次输入的新密码不一致，请重新确认。' });
      return;
    }

    setChangingPassword(true);

    try {
      const baseUrl = getApiBaseUrl();

      // 约定接口：POST /auth/change-password
      // body: { currentPassword, newPassword }
      // 鉴权：通过 httpOnly cookie（credentials: 'include'）
      const res = await fetch(`${baseUrl}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: cur,
          newPassword: next,
        }),
      });

      if (!res.ok) {
        // 登录失效：跳回登录页
        if (res.status === 401 || res.status === 403) {
          setState({ status: 'not-logged-in' });
          router.replace('/login?redirect=/me');
          return;
        }

        const msg = await readApiErrorMessage(res);
        setPasswordMessage({ type: 'error', text: msg });
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');

      // 改密成功后：提示用户重新登录。
      // 注意：如果后端在改密后会让旧登录失效（或清 cookie），这里不要 router.refresh()/自动跳转，
      // 否则页面会立即被 proxy 保护重定向，用户看不到成功提示。
      setPasswordMessage({ type: 'success', text: '密码修改成功。请重新登录后继续使用。' });
      setShowPasswordChangedNotice(true);

      // 可选：主动调用 logout 清理 cookie，但不在这里跳转，让用户先看到提示
      try {
        await fetch(`${baseUrl}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // ignore
      }
    } catch (e) {
      setPasswordMessage({ type: 'error', text: '改密码请求失败，请稍后重试。' });
    } finally {
      setChangingPassword(false);
    }
  };

  const headerSubtitle =
    state.status === 'ready'
      ? `${state.user.email}（ID: ${state.user.id}，角色: ${state.user.role === 'admin' ? 'admin' : 'user'}）`
      : null;

  const tabs: Array<{ key: MeTabKey; label: string }> =
    state.status === 'ready' && state.user.role === 'admin'
      ? [
          { key: 'articles', label: '文章管理' },
          { key: 'courses', label: '课程管理' },
          { key: 'appointments', label: '预约管理' },
          { key: 'profile', label: '用户管理' },
          { key: 'security', label: '账户管理' },
        ]
      : [
          { key: 'courses', label: '我的课程' },
          { key: 'appointments', label: '我的预约' },
          { key: 'profile', label: '个人资料' },
          { key: 'security', label: '账户安全' },
        ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">个人中心</h1>
            {headerSubtitle && <p className="mt-1 text-xs text-slate-500">{headerSubtitle}</p>}
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              className="rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              退出登录
            </button>
          </div>
        </div>

        {state.status === 'error' && (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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

        {state.status === 'ready' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 border-b pb-3">
              {tabs.map((t) => {
                const active = t.key === activeTab;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className={
                      active
                        ? 'rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white'
                        : 'rounded border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50'
                    }
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'articles' && state.user.role === 'admin' && (
              <section className="rounded border border-slate-200 bg-slate-50/60 p-4">
                <h2 className="text-sm font-semibold text-slate-800">管理员入口</h2>
                <p className="mt-2 text-xs text-slate-600">
                  说明：管理员的课程增删改查与收费设置将通过后续的管理页面完成。
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/articles/admin"
                    className="inline-block rounded border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    文章管理
                  </Link>
                  <span className="inline-block rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                    课程管理（待实现）
                  </span>
                  <span className="inline-block rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                    用户管理（待实现）
                  </span>
                </div>
              </section>
            )}

            {activeTab === 'courses' &&
              (state.user.role === 'admin' ? (
                <section className="rounded border border-slate-200 bg-white p-4">
                  <h2 className="text-sm font-semibold text-slate-800">课程管理</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    此功能待实现（后续接入课程的增删改查、定价与上架设置）。
                  </p>
                </section>
              ) : (
                <section className="rounded border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-800">我的课程</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">
                        共 {state.courses.length} 门
                      </span>
                      <Link
                        href="/courses"
                        className="inline-block rounded border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        查看其他课程
                      </Link>
                    </div>
                  </div>

                  {state.courses.length === 0 ? (
                    <div className="rounded border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                      你目前还没有已购/已加入的课程。
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {state.courses.map((c) => (
                        <div
                          key={c.courseId}
                          className="flex items-start justify-between gap-3 rounded border border-slate-100 bg-slate-50/50 p-4"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {c.title}
                            </div>
                            {c.summary ? (
                              <div className="mt-1 line-clamp-2 text-xs text-slate-600">
                                {c.summary}
                              </div>
                            ) : (
                              <div className="mt-1 text-xs text-slate-400">暂无课程简介</div>
                            )}
                            <div className="mt-2 text-[11px] text-slate-400">
                              开通时间：
                              {new Date(c.enrolledAt)
                                .toISOString()
                                .slice(0, 19)
                                .replace('T', ' ')}{' '}
                              UTC
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <Link
                              href={`/courses/${c.slug}`}
                              className="inline-block rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                            >
                              进入课程
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="mt-4 text-[11px] text-slate-400">
                    提示：你可以在课程列表页中浏览其他课程（免费/付费），并在课程页进行加入/购买等操作。
                  </p>
                </section>
              ))}

            {activeTab === 'appointments' && (
              <section className="rounded border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-800">
                  {state.user.role === 'admin' ? '预约管理' : '我的预约'}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {state.user.role === 'admin'
                    ? '此功能待实现（后续接入预约记录列表、状态流转与时间管理）。'
                    : '此功能待实现（后续接入预约记录列表）。'}
                </p>
              </section>
            )}

            {activeTab === 'profile' && (
              <section className="rounded border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-800">
                  {state.user.role === 'admin' ? '用户管理' : '个人资料'}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {state.user.role === 'admin'
                    ? '此功能待实现（后续接入用户列表、权限角色、封禁/重置等管理能力）。'
                    : '此功能待实现（后续支持资料编辑）。'}
                </p>
              </section>
            )}

            {activeTab === 'security' && (
              <section className="rounded border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">
                      {state.user.role === 'admin' ? '账户管理' : '账户安全'}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      你可以在这里修改登录密码。修改后建议退出并重新登录。
                    </p>
                  </div>
                </div>

                {showPasswordChangedNotice && (
                  <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">密码修改成功</div>
                        <div className="mt-0.5">请重新登录后继续使用。</div>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                        onClick={() => {
                          router.replace('/login?redirect=/me');
                        }}
                      >
                        重新登录
                      </button>
                    </div>
                  </div>
                )}

                {passwordMessage &&
                  (!showPasswordChangedNotice || passwordMessage.type === 'error') && (
                    <div
                      className={
                        passwordMessage.type === 'success'
                          ? 'mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800'
                          : 'mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'
                      }
                    >
                      {passwordMessage.text}
                    </div>
                  )}

                {!showPasswordChangedNotice && (
                  <div className="mt-4 grid gap-3 md:max-w-md">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        当前密码
                      </label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        autoComplete="current-password"
                        className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="请输入当前密码"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        新密码
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="至少 8 位"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        确认新密码
                      </label>
                      <input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        autoComplete="new-password"
                        className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="再次输入新密码"
                      />
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleChangePassword}
                        disabled={changingPassword}
                        className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {changingPassword ? '提交中…' : '更新密码'}
                      </button>
                      <p className="mt-2 text-[11px] text-slate-400">
                        提示：为提升安全性，请避免使用过于简单的密码，并定期更换。
                      </p>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
