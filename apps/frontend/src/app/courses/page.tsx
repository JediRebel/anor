// apps/frontend/src/app/courses/page.tsx

import Link from 'next/link';
import { cookies } from 'next/headers';

type CourseAccessType = 'free' | 'paid';

type PublicCourseListItemDto = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  updatedAt?: string | null;
  accessType: CourseAccessType;
  priceCents: number;
};

// 简单用户类型
type SimpleAuthUser = {
  id: number;
  email: string;
  role: string;
};

function formatPriceCents(priceCents: number) {
  const dollars = (priceCents ?? 0) / 100;
  try {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 2,
    }).format(dollars);
  } catch {
    return `$${dollars.toFixed(2)}`;
  }
}

// 格式化时间
function formatTime(isoStr: string | null | undefined) {
  if (!isoStr) return '-';
  try {
    return new Date(isoStr).toLocaleDateString('zh-CN');
  } catch {
    return '-';
  }
}

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    'http://localhost:3001'
  );
}

// 服务端获取当前用户身份
async function getCurrentUser(): Promise<SimpleAuthUser | null> {
  try {
    const cookieStore = await cookies();
    const cookieString = cookieStore.toString();

    const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
      headers: {
        Cookie: cookieString, // 转发 Cookie
      },
      cache: 'no-store',
    });

    if (res.ok) {
      return (await res.json()) as SimpleAuthUser;
    }
    return null;
  } catch {
    return null;
  }
}

export default async function CoursesPage() {
  const apiBaseUrl = getApiBaseUrl();
  const user = await getCurrentUser();
  const isAdmin = user?.role === 'admin';

  let courses: PublicCourseListItemDto[] = [];
  let error: string | null = null;

  try {
    const res = await fetch(`${apiBaseUrl}/courses`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      error = `后端接口返回错误：${res.status} ${res.statusText}`;
    } else {
      courses = (await res.json()) as PublicCourseListItemDto[];
    }
  } catch (e) {
    error = e instanceof Error ? e.message : '无法加载课程列表';
  }

  return (
    <section className="space-y-6">
      <header className="flex items-end justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">移民课程</h1>
          <p className="text-slate-600">
            这里展示全部课程（含免费与付费）。点击“查看详情”进入课程页。
          </p>
        </div>
        {/* 管理员可见的入口 */}
        {isAdmin && (
          <Link
            href="/courses/admin"
            className="mb-1 inline-flex items-center rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
          >
            管理课程
          </Link>
        )}
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="font-medium">加载失败</div>
          <div className="mt-1 text-sm">{error}</div>
          <div className="mt-3 text-sm text-slate-700">
            请确认后端服务已启动，并且前端可访问：
            <span className="ml-1 font-mono">{apiBaseUrl}</span>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {courses.map((c) => {
          const isFree = c.accessType === 'free' || c.priceCents === 0;
          const badgeText = isFree ? '免费' : '付费';
          const priceText = isFree ? '免费' : formatPriceCents(c.priceCents);

          // 根据类型决定显示文案
          const statLabel = isFree ? '浏览' : '已售';

          return (
            <div
              key={c.id}
              className="rounded-xl border bg-white p-5 shadow-sm transition hover:shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="truncate text-lg font-semibold">{c.title}</h2>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      isFree ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {badgeText}
                  </span>
                </div>

                <div className="mt-1 text-sm text-slate-600">{c.summary || '—'}</div>

                {/* 底部元数据区域 */}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <div>
                    <span className="text-slate-400">价格：</span>
                    <span className="font-medium text-slate-900 text-sm">{priceText}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">发布：</span>
                    {formatTime(c.publishedAt)}
                  </div>

                  {/* 管理员可见更多信息 */}
                  {isAdmin && (
                    <>
                      <div>
                        <span className="text-blue-600">最后更新：</span>
                        {/* 无论是否有值都显示，没值显示 - */}
                        <span className="font-medium text-slate-700">
                          {c.updatedAt ? formatTime(c.updatedAt) : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-blue-600">{statLabel}：</span>
                        <span className="font-medium text-slate-700">-</span> {/* 占位符 */}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 按钮区域：左对齐，样式一致 */}
              <div className="mt-5 flex items-center justify-start gap-3">
                <Link
                  href={`/courses/${c.slug}`}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                >
                  查看
                </Link>

                {/* 管理员可见编辑按钮 */}
                {isAdmin && (
                  <Link
                    href={`/courses/admin/${c.id}/edit`}
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                  >
                    编辑
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {!error && courses.length === 0 ? (
          <div className="rounded-lg border bg-white p-6 text-slate-600 md:col-span-2">
            当前暂无已发布的课程。
          </div>
        ) : null}
      </div>
    </section>
  );
}
