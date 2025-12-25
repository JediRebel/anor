// apps/frontend/src/app/articles/page.tsx
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export const revalidate = 60; // 生产环境：默认 60 秒 ISR

type ArticleStatus = 'draft' | 'published';

interface Article {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  content?: string | null;
  coverImageUrl: string | null;
  status: ArticleStatus;
  isPinned: boolean;
  viewCount: number;
  categoryId: number | null;
  authorId: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type ArticlesResult = {
  articles: Article[];
  error?: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

async function getPublishedArticles(): Promise<ArticlesResult> {
  const isDev = process.env.NODE_ENV !== 'production';

  const url = `${API_BASE}/articles`;

  try {
    // 开发环境强制每次请求最新数据；
    // 生产环境走 route 级别的 revalidate = 60。
    const res = await fetch(url, {
      ...(isDev ? { cache: 'no-store' as const } : {}),
    });

    if (!res.ok) {
      const msg = `Failed to fetch articles: ${res.status} ${res.statusText}`;
      console.error('[ArticlesPage] fetch error:', msg, 'url=', url);
      return { articles: [], error: msg };
    }

    const text = await res.text();
    if (!text) {
      console.warn('[ArticlesPage] empty response body from', url);
      return { articles: [] };
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('[ArticlesPage] JSON parse error:', e, 'raw=', text);
      return { articles: [], error: '文章列表数据格式异常（JSON 解析失败）' };
    }

    if (!Array.isArray(data)) {
      console.error('[ArticlesPage] response is not an array:', data);
      return { articles: [], error: '文章列表返回结构异常' };
    }

    return { articles: data as Article[] };
  } catch (error) {
    console.error('[ArticlesPage] unexpected error when fetching:', error);
    return { articles: [], error: '加载文章列表时发生网络或服务器错误' };
  }
}

export default async function ArticlesPage() {
  const { articles, error } = await getPublishedArticles();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">移民资讯</h1>
        <p className="mt-2 text-sm text-gray-600">
          这里会展示你在后台发布的文章列表，按「置顶优先 + 发布时间倒序」排列。
        </p>
      </header>

      {/* 如果后端报错，用一个单独提示，不和“没有文章”混在一起 */}
      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          文章列表加载失败：{error}
        </p>
      )}

      {articles.length === 0 && !error && (
        <p className="text-sm text-gray-600">目前还没有发布的文章。</p>
      )}

      {articles.length > 0 && (
        <ul className="space-y-4">
          {articles.map((article) => (
            <li
              key={article.id}
              className="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300"
            >
              <div className="flex items-start gap-4">
                {article.coverImageUrl && (
                  <div className="hidden h-20 w-32 flex-shrink-0 overflow-hidden rounded-md bg-gray-100 sm:block">
                    <img
                      src={
                        article.coverImageUrl.startsWith('http')
                          ? article.coverImageUrl
                          : `${API_BASE}${article.coverImageUrl}`
                      }
                      alt={article.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/articles/${article.slug}`}
                      className="text-base font-semibold text-gray-900 underline-offset-2 hover:text-blue-700 hover:underline"
                    >
                      {article.title}
                    </Link>
                    {article.isPinned && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        置顶
                      </span>
                    )}
                  </div>

                  {article.summary && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600">{article.summary}</p>
                  )}

                  <p className="mt-2 text-xs text-gray-500">
                    {formatDate(article.publishedAt || article.createdAt)}
                    {article.viewCount > 0 && (
                      <span className="ml-2">· 阅读 {article.viewCount}</span>
                    )}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
