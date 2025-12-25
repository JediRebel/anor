// apps/frontend/src/app/articles/[slug]/page.tsx
import Link from 'next/link';
import { AdminEditButton } from './AdminEditButton';

export const dynamic = 'force-dynamic'; // 详情页始终用最新数据
export const revalidate = 0;

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

// 注意：在 Next 16 里，params 是 Promise，要先 await
type PageProps = {
  params: Promise<{ slug: string }>;
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

async function getArticle(slug: string): Promise<Article | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

  try {
    const res = await fetch(`${baseUrl}/articles/${encodeURIComponent(slug)}`, {
      cache: 'no-store', // 不缓存，避免把 404 结果缓存住
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      console.error('Failed to fetch article detail:', res.status, res.statusText);
      return null;
    }

    const text = await res.text();
    if (!text) return null;

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      console.error('Error parsing article JSON:', e);
      return null;
    }

    // 兼容两种返回结构:
    // 1) 直接返回 Article
    // 2) { success: true, data: Article }
    let data: any = raw;
    if (raw && typeof raw === 'object' && 'data' in (raw as any)) {
      data = (raw as any).data;
    }

    if (!data || typeof data !== 'object') {
      console.error('Unexpected article response shape:', raw);
      return null;
    }

    const article = data as Article;

    // 只允许访问已发布文章
    if (article.status !== 'published') {
      return null;
    }

    return article;
  } catch (error) {
    console.error('Error fetching article detail:', error);
    return null;
  }
}

export default async function ArticleDetailPage(props: PageProps) {
  // ✅ 这里先 await params，再拿 slug
  const { slug } = await props.params;

  const article = await getArticle(decodeURIComponent(slug));

  if (!article) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="mb-4 text-sm text-blue-700">
          <Link href="/articles" className="underline underline-offset-2">
            返回文章列表
          </Link>
        </p>
        <h1 className="mb-2 text-2xl font-bold">未找到对应的文章</h1>
        <p className="text-sm text-gray-600">这篇文章可能尚未发布，或者链接已失效。</p>
      </main>
    );
  }

  // ==== 封面图 URL 统一处理：相对路径 -> 拼接到 API_BASE ====
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
  const coverSrc =
    article.coverImageUrl &&
    (article.coverImageUrl.startsWith('http://') || article.coverImageUrl.startsWith('https://')
      ? article.coverImageUrl
      : `${API_BASE}${article.coverImageUrl}`);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="mb-4 text-sm text-blue-700">
        <Link href="/articles" className="underline underline-offset-2">
          ← 返回文章列表
        </Link>
      </p>

      <article>
        <header className="mb-6 border-b pb-4">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            {article.title}
            {article.isPinned && (
              <span className="rounded-full border border-amber-400 px-2 py-0.5 text-[11px] text-amber-700">
                置顶
              </span>
            )}
          </h1>

          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <span>发布日期：{formatDate(article.publishedAt || article.createdAt)}</span>
            <span>阅读 {article.viewCount} 次</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <AdminEditButton articleId={article.id} />
          </div>

          {article.summary && <p className="mt-3 text-sm text-gray-700">{article.summary}</p>}
        </header>

        {/* 封面图（有的话就显示） */}
        {coverSrc && (
          <div className="mb-6">
            <img
              src={coverSrc}
              alt={article.title}
              className="w-full rounded-lg border border-gray-100 object-cover"
            />
          </div>
        )}

        <section className="prose max-w-none prose-p:leading-relaxed">
          {article.content ? (
            <div className="space-y-3 text-gray-800">
              {article.content
                .split('\n')
                .map((line, idx) =>
                  line.trim() ? <p key={idx}>{line}</p> : <p key={idx}>&nbsp;</p>,
                )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">（暂无正文内容）</p>
          )}
        </section>
      </article>
    </main>
  );
}
