// apps / frontend / src / app / articles / admin / [id] / edit / page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient, ApiError } from '@/lib/api-client';
import { ensureFreshAuth } from '@/lib/auth/client-auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

// ===== 类型定义 =====

type ArticleStatus = 'draft' | 'published';

interface ArticleForm {
  title: string;
  slug: string;
  summary: string;
  content: string;
  status: ArticleStatus;
  isPinned: boolean;
  coverImageUrl: string;
}

interface ArticleFromServer {
  id: number;
  title: string | null;
  slug: string | null;
  summary: string | null;
  content: string | null;
  status: ArticleStatus;
  isPinned: boolean;
  coverImageUrl?: string | null;
  viewCount?: number;
  categoryId?: number | null;
  authorId?: number | null;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 非 admin 访问时，用一个“伪 404” 替代真正的权限错误提示。
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

export default function EditArticlePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  const [form, setForm] = useState<ArticleForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ===== 前端检查是否为 admin =====
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let role: string | undefined;

    try {
      // 1) 旧结构 anor_user
      const rawUser = window.localStorage.getItem('anor_user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed && typeof parsed === 'object') {
          role = (parsed as any).role;
        }
      }

      // 2) 新结构 anor_auth.user
      if (!role) {
        const rawAuth = window.localStorage.getItem('anor_auth');
        if (rawAuth) {
          const parsedAuth = JSON.parse(rawAuth);
          if (
            parsedAuth &&
            typeof parsedAuth === 'object' &&
            (parsedAuth as any).user &&
            typeof (parsedAuth as any).user === 'object'
          ) {
            role = (parsedAuth as any).user.role;
          }
        }
      }
    } catch {
      // 解析失败就当没登录，不需要 console.error
    }

    setIsAdmin(role === 'admin');
    setCheckedAuth(true);
  }, []);

  // ===== 在确认是 admin 之后，再加载文章数据（带滑动刷新） =====
  useEffect(() => {
    // 还没检查完本地登录信息，先不请求后端
    if (!checkedAuth) return;

    // 检查完发现不是 admin：直接结束加载
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    if (!id || Number.isNaN(id)) {
      setLoadError('无效的文章 ID。');
      setLoading(false);
      return;
    }

    const fetchArticle = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        // 先确保本地 token 是“新鲜的”，必要时用 refreshToken 自动刷新
        const auth = await ensureFreshAuth();

        if (!auth?.accessToken) {
          setLoadError('加载文章失败：当前管理员登录已失效，请重新登录管理员账号后再访问后台。');
          setLoading(false);
          return;
        }

        const data = await apiClient.get<ArticleFromServer>(`/admin/articles/${id}`, {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
          },
        });

        if (!data) {
          setLoadError('未找到对应的文章。');
          return;
        }

        setForm({
          title: data.title ?? '',
          slug: data.slug ?? '',
          summary: data.summary ?? '',
          content: data.content ?? '',
          status: data.status,
          isPinned: data.isPinned,
          coverImageUrl: data.coverImageUrl ?? '',
        });
      } catch (err) {
        const apiErr = err as ApiError;

        if (apiErr.status === 404) {
          setLoadError('未找到对应的文章。');
        } else if (apiErr.status === 401 || apiErr.status === 403) {
          setLoadError('加载文章失败：当前管理员登录已失效，请重新登录管理员账号后再访问后台。');
        } else {
          setLoadError(apiErr.message || '加载文章失败，请稍后重试。');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id, checkedAuth, isAdmin]);

  async function handleCoverFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 清理上一次的错误信息
    setUploadError(null);
    setUploadingCover(true);

    try {
      // 先确保当前管理员登录状态 + token 有效（必要时自动 refresh）
      const auth = await ensureFreshAuth();
      if (!auth?.accessToken) {
        setUploadError('上传失败：当前管理员登录已失效，请重新登录管理员账号后再尝试上传封面。');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/admin/uploads/article-cover`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: formData,
      });

      if (!res.ok) {
        let message = '上传封面图失败，请稍后重试。';

        if (res.status === 401 || res.status === 403) {
          message = '上传失败：当前管理员登录已失效，请重新登录管理员账号后再尝试上传封面。';
        } else {
          // 尝试读取后端返回的 message
          try {
            const data = await res.json();
            if (data && typeof (data as any).message === 'string') {
              message = (data as any).message;
            }
          } catch {
            // 保持默认文案
          }
        }

        throw new Error(message);
      }

      const json = (await res.json()) as { url?: string };
      const urlFromServer = json.url;

      if (!urlFromServer) {
        throw new Error('后端未返回封面地址，请联系管理员。');
      }

      // 写回表单：保存后端返回的对外 URL
      setForm((prev) => (prev ? { ...prev, coverImageUrl: urlFromServer } : prev));
    } catch (err) {
      const message = err instanceof Error ? err.message : '上传封面图失败，请稍后重试。';
      setUploadError(message);
    } finally {
      setUploadingCover(false);
      // 清空 input 的值，方便连续选择同一文件（包括同一张图）
      e.target.value = '';
    }
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setForm((prev: ArticleForm | null) => (prev ? { ...prev, [name]: value } : prev));
  }

  function handlePinnedChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { checked } = e.target;
    setForm((prev: ArticleForm | null) => (prev ? { ...prev, isPinned: checked } : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (submitting) return;

    setErrorMsg(null);

    // 极简前端校验
    if (!form.title.trim()) {
      setErrorMsg('请输入文章标题');
      return;
    }
    if (!form.slug.trim()) {
      setErrorMsg('请输入 slug（URL 片段）');
      return;
    }

    const payload: Partial<ArticleForm> = {
      ...form,
      title: form.title.trim(),
      slug: form.slug.trim(),
      summary: form.summary.trim(),
      coverImageUrl: form.coverImageUrl,
      // content 允许保留前后空格
    };

    // 先确保当前登录状态和 token 有效（必要时自动 refresh）
    const auth = await ensureFreshAuth();

    if (!auth?.accessToken) {
      setErrorMsg('保存失败：当前管理员登录已失效，请重新登录管理员账号后再尝试保存。');
      router.push('/login');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.put(`/admin/articles/${id}`, payload, {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      });

      // 成功后返回列表
      router.push('/articles/admin');
    } catch (err) {
      const apiErr = err as ApiError;
      let msg: string | null = null;

      if (apiErr.status === 401 || apiErr.status === 403) {
        msg = '保存失败：当前管理员登录已失效，请重新登录管理员账号后再尝试保存。';
        setErrorMsg(msg);
        router.push('/login');
        return;
      } else if (apiErr.status === 409) {
        // 409：slug 冲突
        msg = 'SLUG 已存在，请提供一个新的 SLUG。';
      } else if (apiErr.status === 400) {
        // 400：class-validator 校验不通过（slug 格式、长度等）
        if (apiErr.data && typeof apiErr.data === 'object') {
          const data: any = apiErr.data;
          if (Array.isArray(data.message) && data.message.length > 0) {
            msg = String(data.message[0]);
          } else if (typeof data.message === 'string') {
            msg = data.message;
          }
        }
      }

      setErrorMsg(msg || apiErr.message || '更新文章失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  }

  // ===== 视图渲染部分 =====

  // 1）还在检查本地登录状态时
  if (!checkedAuth) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-gray-500">正在检查登录状态…</p>
      </main>
    );
  }

  // 2）检查完发现不是 admin：返回伪 404
  if (!isAdmin) {
    return <AdminNotFound />;
  }

  // 3）admin，但还在加载文章 / 或加载失败
  if (loading || !form) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="mb-4 text-sm text-blue-700">
          <Link href="/articles/admin" className="underline underline-offset-2">
            返回后台文章列表
          </Link>
        </p>

        {loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : (
          <p className="text-sm text-gray-600">正在加载文章…</p>
        )}
      </main>
    );
  }

  // 4）admin 且已成功加载文章
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="mb-4 text-sm text-blue-700">
        <Link href="/articles/admin" className="underline underline-offset-2">
          返回后台文章列表
        </Link>
      </p>

      <h1 className="mb-4 text-2xl font-bold tracking-tight">编辑文章</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-4"
      >
        {/* 顶部错误提示（slug 不合法、slug 冲突、401 等都会显示在这里） */}
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

        {/* 标题 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">文章标题</label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="例如：2026 年加拿大 EE 新政解读"
          />
        </div>

        {/* slug */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Slug（URL 片段）</label>
          <input
            type="text"
            name="slug"
            value={form.slug}
            onChange={handleChange}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="例如：ee-2026-policy-overview"
          />
          <p className="mt-1 text-xs text-gray-500">
            仅允许小写字母、数字和中划线，不能以中划线开头或结尾，单词之间用中划线连接。
          </p>
        </div>

        {/* 封面图（可选） */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">封面图 URL（可选）</label>
          <input
            type="text"
            name="coverImageUrl"
            value={form.coverImageUrl}
            onChange={handleChange}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="例如：/uploads/article-covers/xxx.jpg 或完整的图片 URL"
          />
          <p className="mt-1 text-xs text-gray-500">
            可以直接填写完整可访问的图片
            URL，或使用下方「从本地上传图片」按钮由后台上传后自动填入相对路径。
          </p>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1">
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('cover-file-input');
                  if (input) input.click();
                }}
                className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                disabled={uploadingCover}
              >
                {uploadingCover ? '上传中…' : '从本地上传图片'}
              </button>
              <input
                id="cover-file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverFileChange}
              />
              {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
            </div>

            <div className="mt-3 w-40 flex-shrink-0 rounded-md border border-dashed border-gray-300 bg-gray-50 p-2 text-center text-xs text-gray-500 sm:mt-0">
              {form.coverImageUrl ? (
                <img
                  src={
                    form.coverImageUrl.startsWith('http')
                      ? form.coverImageUrl
                      : `${API_BASE}${form.coverImageUrl}`
                  }
                  alt="封面预览"
                  className="mx-auto h-32 w-full rounded object-cover"
                />
              ) : (
                <span>当前无封面图</span>
              )}
            </div>
          </div>
        </div>

        {/* 摘要 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">摘要（列表页显示）</label>
          <textarea
            name="summary"
            value={form.summary}
            onChange={handleChange}
            rows={2}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="简单说明本文在讲什么，1～3 句话即可。"
          />
        </div>

        {/* 正文 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">正文内容</label>
          <textarea
            name="content"
            value={form.content}
            onChange={handleChange}
            rows={8}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="这里先用纯文本写内容，后面有需要再换成富文本编辑器。"
          />
        </div>

        {/* 状态 + 置顶 */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-700">状态：</span>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="published">已发布</option>
              <option value="draft">草稿</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isPinned}
              onChange={handlePinnedChange}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            置顶显示
          </label>
        </div>

        {/* 提交按钮 */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? '提交中…' : '保存文章'}
          </button>
        </div>
      </form>
    </main>
  );
}
