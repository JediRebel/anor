// apps/frontend/src/app/articles/admin/new/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type ArticleStatus = 'draft' | 'published';

interface CreateArticlePayload {
  title: string;
  slug: string;
  summary: string;
  content: string;
  status: ArticleStatus;
  isPinned: boolean;
  // 新增：封面图 URL（前端用 string，提交前会做 trim）
  coverImageUrl: string;
}

// 上传接口使用的后端基础地址
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

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

export default function NewArticlePage() {
  const router = useRouter();

  const [form, setForm] = useState<CreateArticlePayload>({
    title: '',
    slug: '',
    summary: '',
    content: '',
    status: 'published',
    isPinned: false,
    coverImageUrl: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ====== 前端只允许 admin 访问 ======
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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
          // 未登录/登录失效：跳转登录，让用户重新获取 cookie
          if (res.status === 401 || res.status === 403) {
            if (!cancelled) {
              setIsAdmin(false);
              setCheckedAuth(true);
            }
            router.replace('/login?redirect=/articles/admin/new');
            return;
          }

          // 其他异常：仍按非管理员处理（伪 404）
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
  }, [router]);

  // 还在检测本地登录信息时
  if (!checkedAuth) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-gray-500">正在检查登录状态…</p>
      </main>
    );
  }

  // 检查完发现不是管理员账号：前端伪装为 404，不暴露后台入口
  if (!isAdmin) {
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

  // ====== 新建文章表单逻辑 ======

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCoverFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    if (!file.type.startsWith('image/')) {
      setUploadError('请选择图片文件。');
      (e.target as HTMLInputElement).value = '';
      return;
    }

    setUploadingCover(true);

    try {
      const formData = new FormData();
      // 字段名 file 要和后端 FileInterceptor('file') 对应
      formData.append('file', file);

      // 使用 httpOnly cookie 鉴权
      const res = await fetch(`${API_BASE}/admin/uploads/article-cover`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (res.status === 401 || res.status === 403) {
        setUploadError('当前登录状态已失效或无权限，请重新登录管理员账号后再上传封面图。');
        router.push('/login?redirect=/articles/admin/new');
        return;
      }

      if (!res.ok) {
        // 尝试读后端错误信息
        let serverMsg: string | null = null;
        try {
          const errJson = (await res.json()) as any;
          if (errJson && typeof errJson === 'object') {
            if (typeof errJson.message === 'string') serverMsg = errJson.message;
            else if (Array.isArray(errJson.message) && typeof errJson.message[0] === 'string') {
              serverMsg = errJson.message[0];
            }
          }
        } catch {
          // ignore
        }

        setUploadError(serverMsg || '上传封面图失败，请稍后重试。');
        return;
      }

      const data = (await res.json()) as { url?: string; path?: string };

      let stored = '';
      if (data && typeof data === 'object') {
        if (typeof data.url === 'string') stored = data.url.trim();
        else if (typeof data.path === 'string') stored = data.path.trim();
      }

      if (!stored) {
        setUploadError('上传成功，但未收到图片地址，请稍后重试。');
        return;
      }

      setForm((prev) => ({
        ...prev,
        coverImageUrl: stored,
      }));
    } catch {
      setUploadError('上传封面图失败，请稍后重试。');
    } finally {
      setUploadingCover(false);
      // 清空 input 的值，方便再次选择同一文件
      (e.target as HTMLInputElement).value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    // 极简校验：标题和 slug 必填
    if (!form.title.trim()) {
      setErrorMsg('请输入文章标题');
      return;
    }
    if (!form.slug.trim()) {
      setErrorMsg('请输入 SLUG（URL 片段）');
      return;
    }

    // 提交前做一次简单的 trim，避免多余空格
    const payload: CreateArticlePayload = {
      ...form,
      title: form.title.trim(),
      slug: form.slug.trim(),
      summary: form.summary.trim(),
      coverImageUrl: form.coverImageUrl.trim(),
      // content 允许保留前后空格
    };

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.status === 401 || res.status === 403) {
        setErrorMsg('创建失败：当前登录已过期或无权限，请重新登录管理员账号后再尝试创建。');
        router.push('/login?redirect=/articles/admin/new');
        return;
      }

      if (res.status === 409) {
        const msg = await readApiErrorMessage(res);
        setErrorMsg(msg && msg.trim() ? msg : 'SLUG 已存在，请提供一个新的 SLUG。');
        return;
      }

      if (!res.ok) {
        const msg = await readApiErrorMessage(res);
        setErrorMsg(msg || '创建失败，请稍后重试。');
        return;
      }

      // 成功后跳回后台列表页
      router.push('/articles/admin');
    } catch {
      setErrorMsg('创建失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  }

  const resolvedCoverPreviewUrl = form.coverImageUrl
    ? form.coverImageUrl.startsWith('http')
      ? form.coverImageUrl
      : `${API_BASE}${form.coverImageUrl}`
    : '';

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="mb-4 text-sm text-blue-700">
        <Link href="/articles/admin" className="underline underline-offset-2">
          返回后台文章列表
        </Link>
      </p>

      <h1 className="mb-4 text-2xl font-bold tracking-tight">新建文章</h1>
      <p className="mb-6 text-sm text-gray-600">
        这一版先做最简单的字段：标题、slug、摘要、正文。状态默认“已发布”，后续我们再加草稿、分类等功能。
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-4"
      >
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
            访问链接会是：/articles/&lt;slug&gt;，例如 /articles/ee-2026-policy-overview。
          </p>
        </div>

        {/* 封面图 URL（选填） */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">封面图 URL（选填）</label>
          <input
            type="text"
            name="coverImageUrl"
            value={form.coverImageUrl}
            onChange={handleChange}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="例如：/uploads/article-covers/xxxx.jpg 或完整的 https:// 链接"
          />
          <p className="mt-1 text-xs text-gray-500">
            可以直接填写完整可访问的图片 URL，或后台上传接口返回的相对路径（例如
            /uploads/article-covers/xxx.jpg）。前台列表和详情页会优先使用该图片。
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {/* 隐藏的文件选择框 */}
            <input
              id="cover-file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverFileChange}
            />

            {/* 触发选择文件的按钮 */}
            <button
              type="button"
              onClick={() => {
                const input = document.getElementById(
                  'cover-file-input',
                ) as HTMLInputElement | null;
                if (input) input.click();
              }}
              className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              disabled={uploadingCover}
            >
              {uploadingCover ? '上传中…' : '从本地上传图片'}
            </button>

            {uploadError && <span className="text-red-500">{uploadError}</span>}
          </div>

          {resolvedCoverPreviewUrl && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-gray-500">封面预览：</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvedCoverPreviewUrl}
                alt="封面预览"
                className="h-32 w-56 rounded-md border object-cover"
              />
            </div>
          )}
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

        {/* 状态和置顶 */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-700">状态：</span>
            <select
              name="status"
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  status: e.target.value as ArticleStatus,
                }))
              }
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
              onChange={(e) => setForm((prev) => ({ ...prev, isPinned: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            置顶显示
          </label>
        </div>

        {/* 错误信息 */}
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

        {/* 提交按钮 */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting || uploadingCover}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? '提交中…' : '保存文章'}
          </button>
        </div>
      </form>
    </main>
  );
}
