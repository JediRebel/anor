// apps/frontend/src/app/me/page.tsx

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { type AuthUser } from '@/lib/api/auth';
import { apiClient } from '@/lib/api-client'; // ✅ [修改] 引入封装好的 apiClient
import { useAuth } from '@/components/auth-provider';

type MyCourseListItemDto = {
  courseId: string;
  title: string;
  slug: string;
  summary: string | null;
  coverImageUrl: string | null;
  enrolledAt: string;
};

// ✅ [修改] 使用 apiClient 替代原生 fetch
async function fetchCurrentUser(): Promise<AuthUser> {
  // apiClient 会自动处理 baseURL 和 credentials，也会自动处理 401 刷新
  return apiClient.get<AuthUser>('/auth/me');
}

// ✅ [修改] 使用 apiClient 替代原生 fetch
async function getMyCourses(): Promise<MyCourseListItemDto[]> {
  return apiClient.get<MyCourseListItemDto[]>('/me/courses');
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

  const { refresh } = useAuth();

  // 账户安全：改密码
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
        // 并行加载用户和课程数据
        // 如果 401，apiClient 内部会尝试刷新一次。如果还是 401，这里会抛错
        const [user, courses] = await Promise.all([fetchCurrentUser(), getMyCourses()]);

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

        // 真正的未登录（RT也过期了，或者压根没登录）
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

  // 未登录或仍在加载时，不渲染任何内容（避免闪烁）
  if (state.status === 'loading' || state.status === 'not-logged-in') {
    return null;
  }

  const handleLogout = async () => {
    try {
      // ✅ [修改] 使用 apiClient 退出
      await apiClient.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      await refresh();
      setState({ status: 'not-logged-in' });
      router.replace('/login');
      router.refresh();
    }
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
      // ✅ [修改] 使用 apiClient 修改密码
      await apiClient.post('/auth/change-password', {
        currentPassword: cur,
        newPassword: next,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');

      setPasswordMessage({ type: 'success', text: '密码修改成功。请重新登录后继续使用。' });
      setShowPasswordChangedNotice(true);

      // 退出登录，但不跳转
      try {
        await apiClient.post('/auth/logout');
      } catch {
        // ignore
      }
    } catch (e: any) {
      // 如果 Token 在改密码过程中过期且无法刷新，会到这里
      if (e?.status === 401 || e?.status === 403) {
        setState({ status: 'not-logged-in' });
        router.replace('/login?redirect=/me');
        return;
      }

      const msg = e.message || '改密码请求失败，请稍后重试。';
      setPasswordMessage({ type: 'error', text: msg });
    } finally {
      setChangingPassword(false);
    }
  };

  // ... 后面的 JSX 渲染逻辑不用变 ...
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
