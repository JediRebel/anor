// apps/frontend/src/app/articles/page.tsx
import Link from 'next/link';
import { cookies } from 'next/headers';

// 建议：默认用 127.0.0.1，避免某些环境下 localhost 解析到 ::1 引发偶发连接问题
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:3001';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AuthUser = {
  id: number;
  email: string;
  role: 'admin' | 'user';
};

type PublicArticleListItem = {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  viewCount?: number;
};

type PaginatedResponse<T> = {
  items: T[];
  total?: number;
  page?: number;
  pageSize?: number;
};

async function buildCookieHeader(): Promise<string> {
  // 兼容：某些 Next/TS 配置下 cookies() 会被推断成 Promise<ReadonlyRequestCookies>
  const cookieStore = await Promise.resolve(cookies() as any);

  const at = cookieStore.get('anor_at')?.value;

  const parts: string[] = [];
  if (at) parts.push(`anor_at=${at}`);

  return parts.join('; ');
}

async function fetchMe(): Promise<AuthUser | null> {
  try {
    // Server Component：调用后端时必须手动转发 cookie
    const cookieHeader = await buildCookieHeader();
    if (!cookieHeader) return null;

    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      headers: {
        cookie: cookieHeader,
      },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    return (await res.json()) as AuthUser;
  } catch {
    // 后端未启动 / 网络失败时，避免页面直接 500
    return null;
  }
}

async function fetchPublishedArticles(): Promise<PublicArticleListItem[]> {
  try {
    // Public list: do NOT require auth cookies. Keep it simple.
    // We try a paginated shape first (items/total), and fall back to array.
    const url = new URL(`${API_BASE}/articles`);
    url.searchParams.set('status', 'published');
    url.searchParams.set('page', '1');
    url.searchParams.set('pageSize', '50');

    const res = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
    });

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as unknown;

    if (Array.isArray(data)) {
      return data as PublicArticleListItem[];
    }

    if (data && typeof data === 'object' && Array.isArray((data as any).items)) {
      return (data as PaginatedResponse<PublicArticleListItem>).items ?? [];
    }

    return [];
  } catch {
    // 后端未启动 / 网络失败时，避免页面直接 500
    return [];
  }
}

export default async function ArticlesPage() {
  const me = await fetchMe();
  const isAdmin = me?.role === 'admin';
  const articles = await fetchPublishedArticles();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">文章</h1>
          <p className="mt-2 text-sm text-gray-600">这里将展示已发布的文章列表（前台）。</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <Link
              href="/articles/admin"
              className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              进入文章管理
            </Link>
          ) : null}
        </div>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">文章列表</div>
            <div className="mt-1 text-xs text-gray-500">展示已发布文章（前台）。</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin ? (
              <Link
                href="/articles/admin"
                className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                进入文章管理
              </Link>
            ) : null}
          </div>
        </div>

        {isAdmin && me ? (
          <div className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-xs text-slate-700">
            你已以管理员身份登录：{me.email}（ID: {me.id}）。
          </div>
        ) : null}

        {articles.length === 0 ? (
          <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            暂无已发布文章。
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {articles.map((a) => {
              const cover = a.coverImageUrl
                ? a.coverImageUrl.startsWith('http')
                  ? a.coverImageUrl
                  : `${API_BASE}${a.coverImageUrl}`
                : null;

              return (
                <Link
                  key={a.id}
                  href={`/articles/${a.slug}`}
                  className="group flex gap-4 rounded-lg border border-slate-100 bg-white p-4 hover:border-slate-200"
                >
                  <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md border border-slate-100 bg-slate-50">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt={a.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                        无封面
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900 group-hover:underline">
                      {a.title}
                    </div>
                    {a.summary ? (
                      <div className="mt-1 line-clamp-2 text-xs text-slate-600">{a.summary}</div>
                    ) : (
                      <div className="mt-1 text-xs text-slate-400">暂无摘要</div>
                    )}

                    <div className="mt-2 text-[11px] text-slate-400">
                      {a.publishedAt
                        ? `发布时间：${new Date(a.publishedAt).toLocaleString('zh-CN')}`
                        : ''}
                      {typeof a.viewCount === 'number' ? `  ·  浏览：${a.viewCount}` : ''}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            返回首页
          </Link>
        </div>
      </section>
    </main>
  );
}
