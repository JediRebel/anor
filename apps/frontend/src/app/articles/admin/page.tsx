// apps/frontend/src/app/articles/admin/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type ArticleStatus = 'draft' | 'published';

interface Article {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
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

interface AdminArticlesResponse {
  items: Article[];
  total: number;
  page: number;
  pageSize: number;
}

type SortBy = 'title' | 'viewCount' | 'createdAt' | 'publishedAt';
type SortOrder = 'asc' | 'desc';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function classNames(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(' ');
}

async function readApiErrorMessage(res: Response) {
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
}

/**
 * 非 admin（未登录 / 普通用户等）访问后台列表时显示的 “伪 404” 页。
 * 不跳转、不清理登录状态。
 */
function AdminNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-4 text-3xl font-bold tracking-tight">404 页面不存在</h1>
      <p className="mb-6 text-sm text-gray-600">您访问的页面不存在。</p>
      <Link
        href="/"
        className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        返回首页
      </Link>
    </main>
  );
}

export default function ArticlesAdminPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [onlyWithCover, setOnlyWithCover] = useState(false);
  const [onlyWithoutCover, setOnlyWithoutCover] = useState(false);

  // ==== 登录 / 角色检查 ====
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // 使用后端 /auth/me（httpOnly cookie）判断是否管理员。

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (!res.ok) {
          if (!cancelled) {
            setIsAdmin(false);
            setCheckedAuth(true);
          }
          return;
        }

        const me = (await res.json()) as { role?: string };
        if (!cancelled) {
          setIsAdmin(me?.role === 'admin');
          setCheckedAuth(true);
        }
      } catch {
        if (!cancelled) {
          setIsAdmin(false);
          setCheckedAuth(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ==== 只有在“已经确认是 admin”之后，才去请求后台列表 ====
  useEffect(() => {
    if (!checkedAuth) return;

    // 不是 admin（包括未登录 / 普通用户）直接结束，不请求接口
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchArticles = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/admin/articles?page=1&pageSize=200`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (res.status === 401 || res.status === 403) {
          const msg = await readApiErrorMessage(res);
          if (!cancelled) {
            setError(msg || '当前管理员登录已过期，请重新登录后再访问后台文章列表。');
            setArticles([]);
          }
          return;
        }

        if (!res.ok) {
          const msg = await readApiErrorMessage(res);
          if (!cancelled) setError(msg || '加载文章列表失败，请稍后重试。');
          return;
        }

        const data = (await res.json()) as AdminArticlesResponse;
        if (!cancelled) setArticles(data.items ?? []);
      } catch {
        if (!cancelled) setError('加载文章列表失败，请稍后重试。');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchArticles();

    return () => {
      cancelled = true;
    };
  }, [checkedAuth, isAdmin]);

  const handleTogglePin = async (id: number, current: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/admin/articles/${id}/pin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ isPinned: !current }),
      });

      if (res.status === 401 || res.status === 403) {
        const msg = await readApiErrorMessage(res);
        setError(msg || '当前管理员登录已过期，请重新登录后再尝试修改置顶状态。');
        return;
      }

      if (!res.ok) {
        const msg = await readApiErrorMessage(res);
        setError(msg || '置顶状态修改失败，请稍后重试。');
        return;
      }

      const updated = (await res.json()) as Article;
      setArticles((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch {
      setError('置顶状态修改失败，请稍后重试。');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这篇文章吗？此操作不可恢复。')) return;

    try {
      const res = await fetch(`${API_BASE}/admin/articles/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.status === 401 || res.status === 403) {
        const msg = await readApiErrorMessage(res);
        setError(msg || '当前管理员登录已过期，请重新登录后再尝试删除文章。');
        return;
      }

      if (!res.ok) {
        const msg = await readApiErrorMessage(res);
        setError(msg || '删除失败，请稍后再试。');
        return;
      }

      setArticles((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError('删除失败，请稍后再试。');
    }
  };

  const handleEdit = (id: number) => {
    window.location.href = `/articles/admin/${id}/edit`;
  };

  /**
   * 点击表头排序
   */
  const handleSortClick = (field: SortBy) => {
    if (field === sortBy) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(field);
    setSortOrder(field === 'title' ? 'asc' : 'desc');
  };

  const renderSortIndicator = (field: SortBy) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  const filteredAndSorted = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    let list = [...articles];

    // 封面过滤：只看有封面 / 只看无封面；如果两个都勾选则视为不过滤
    if (onlyWithCover && !onlyWithoutCover) {
      list = list.filter((a) => !!a.coverImageUrl);
    } else if (!onlyWithCover && onlyWithoutCover) {
      list = list.filter((a) => !a.coverImageUrl);
    }

    if (keyword) {
      list = list.filter((a) => {
        const title = a.title?.toLowerCase() ?? '';
        const summary = a.summary?.toLowerCase() ?? '';
        return (
          title.includes(keyword) ||
          summary.includes(keyword) ||
          a.slug.toLowerCase().includes(keyword)
        );
      });
    }

    list.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      const dir = sortOrder === 'asc' ? 1 : -1;

      const getFieldValue = (article: Article) => {
        switch (sortBy) {
          case 'title':
            return article.title || '';
          case 'viewCount':
            return article.viewCount ?? 0;
          case 'createdAt': {
            const t = new Date(article.createdAt).getTime();
            return Number.isNaN(t) ? 0 : t;
          }
          case 'publishedAt': {
            if (!article.publishedAt) return 0;
            const t = new Date(article.publishedAt).getTime();
            return Number.isNaN(t) ? 0 : t;
          }
          default:
            return '';
        }
      };

      const va = getFieldValue(a);
      const vb = getFieldValue(b);

      if (typeof va === 'number' && typeof vb === 'number') {
        if (va === vb) return b.id - a.id;
        return (va - vb) * dir;
      }

      const sa = String(va);
      const sb = String(vb);
      if (sa === sb) return b.id - a.id;
      return sa.localeCompare(sb) * dir;
    });

    return list;
  }, [articles, search, sortBy, sortOrder, onlyWithCover, onlyWithoutCover]);

  // ==== 视图渲染 ====

  // 还在检查本地登录状态
  if (!checkedAuth) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-gray-500">正在检查登录状态…</p>
      </main>
    );
  }

  // 非 admin（未登录 / 普通用户 / 付费用户等）：显示 404 风格页面
  if (!isAdmin) {
    return <AdminNotFound />;
  }

  // 真正 admin 才会看到的后台列表
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">文章管理（后台）</h1>
            <p className="mt-1 text-sm text-gray-600">
              这里显示数据库中的文章列表（包含草稿和已发布）。列表按「置顶优先 +
              可选排序字段」显示。
            </p>
          </div>
        </div>

        {/* 过滤器区域：两行布局 */}
        <div className="mt-4 flex flex-col gap-3">
          {/* 第一行：搜索 + 新建文章 */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="按标题 / 摘要 / SLUG 搜索"
              className="min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <Link
              href="/articles/admin/new"
              className="inline-flex shrink-0 items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              新建文章
            </Link>
          </div>

          {/* 第二行：封面过滤 + 查看前台文章列表 */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={onlyWithCover}
                onChange={(e) => setOnlyWithCover(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              只看有封面文章
            </label>

            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={onlyWithoutCover}
                onChange={(e) => setOnlyWithoutCover(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              只看无封面文章
            </label>

            <Link
              href="/articles"
              className="ml-auto inline-flex items-center rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-gray-400"
            >
              查看前台文章列表
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">加载中…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  置顶
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  封面
                </th>
                <th
                  className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  onClick={() => handleSortClick('title')}
                >
                  标题 / 摘要{renderSortIndicator('title')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  SLUG
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  状态
                </th>
                <th
                  className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  onClick={() => handleSortClick('viewCount')}
                >
                  浏览量{renderSortIndicator('viewCount')}
                </th>
                <th
                  className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  onClick={() => handleSortClick('createdAt')}
                >
                  创建时间{renderSortIndicator('createdAt')}
                </th>
                <th
                  className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  onClick={() => handleSortClick('publishedAt')}
                >
                  发布时间{renderSortIndicator('publishedAt')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  操作
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredAndSorted.map((article) => {
                const resolvedCoverUrl = article.coverImageUrl
                  ? article.coverImageUrl.startsWith('http')
                    ? article.coverImageUrl
                    : `${API_BASE}${article.coverImageUrl}`
                  : null;
                return (
                  <tr key={article.id}>
                    <td className="px-4 py-3 text-sm text-gray-500">{article.id}</td>

                    <td className="px-4 py-3 text-sm">
                      <button
                        type="button"
                        onClick={() => handleTogglePin(article.id, article.isPinned)}
                        className={classNames(
                          'rounded-full border px-3 py-1 text-xs',
                          article.isPinned
                            ? 'border-amber-400 bg-amber-50 text-amber-700'
                            : 'border-gray-300 text-gray-600 hover:border-gray-400',
                        )}
                      >
                        {article.isPinned ? '取消置顶' : '置顶'}
                      </button>
                    </td>

                    <td className="px-4 py-3">
                      {resolvedCoverUrl ? (
                        <div className="h-12 w-16 overflow-hidden rounded border border-gray-200 bg-gray-50">
                          <img
                            src={resolvedCoverUrl}
                            alt={article.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">无</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        href={`/articles/${article.slug}`}
                        target="_blank"
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {article.title}
                      </Link>
                      {article.summary && (
                        <div className="mt-1 line-clamp-1 text-xs text-gray-500">
                          {article.summary}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-600">{article.slug}</td>

                    <td className="px-4 py-3 text-sm">
                      {article.status === 'published' ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          已发布
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          草稿
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-700">{article.viewCount ?? 0}</td>

                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDateTime(article.createdAt)}
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDateTime(article.publishedAt)}
                    </td>

                    <td className="space-x-3 px-4 py-3 text-sm">
                      <button
                        type="button"
                        onClick={() => handleEdit(article.id)}
                        className="text-blue-600 hover:underline"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(article.id)}
                        className="text-red-500 hover:underline"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!filteredAndSorted.length && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500">
                    当前没有符合条件的文章。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
