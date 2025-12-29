// apps/frontend/src/app/courses/page.tsx

import Link from 'next/link';

type CourseAccessType = 'free' | 'paid';

type PublicCourseListItemDto = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  accessType: CourseAccessType;
  priceCents: number;
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

function formatPublishedAt(publishedAt: string | null) {
  if (!publishedAt) return '未发布';
  const d = new Date(publishedAt);
  if (Number.isNaN(d.getTime())) return '未发布';
  return d.toLocaleString();
}

function getApiBaseUrl() {
  // Prefer env, fall back to local dev.
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    'http://localhost:3001'
  );
}

export default async function CoursesPage() {
  const apiBaseUrl = getApiBaseUrl();

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
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">移民课程</h1>
        <p className="text-slate-600">
          这里展示全部课程（含免费与付费）。点击“查看详情”进入课程页。
        </p>
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

          return (
            <div
              key={c.id}
              className="rounded-xl border bg-white p-5 shadow-sm transition hover:shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
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

                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
                    <div>
                      <span className="text-slate-500">价格：</span>
                      <span className="font-medium text-slate-900">{priceText}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">发布时间：</span>
                      <span>{formatPublishedAt(c.publishedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <Link
                    href={`/courses/${c.slug}`}
                    className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                  >
                    查看详情
                  </Link>
                </div>
              </div>
            </div>
          );
        })}

        {!error && courses.length === 0 ? (
          <div className="rounded-lg border bg-white p-6 text-slate-600 md:col-span-2">
            当前暂无课程。
          </div>
        ) : null}
      </div>
    </section>
  );
}
