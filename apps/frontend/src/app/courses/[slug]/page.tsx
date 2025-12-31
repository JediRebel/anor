// apps/frontend/src/app/courses/[slug]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Pencil } from 'lucide-react'; // [新增] 引入图标

import type { AuthUser } from '@/lib/api/auth';

// ... (类型定义和 apiBaseUrl 辅助函数保持不变，省略以节省篇幅，请保留原有的) ...
// 必须保留的辅助函数和类型:
// MyCourseListItemDto, getMyCourses, PublicCourseDetailDto, PublicLessonListItemDto, PublicLessonDetailDto, apiBaseUrl, getCourse, getLessons, getLessonDetail

// 为了完整性，这里补上你需要保留的 helper imports/definitions
type MyCourseListItemDto = {
  courseId: string;
  title: string;
  slug: string;
  summary: string | null;
  coverImageUrl: string | null;
  enrolledAt: string;
};

async function getMyCourses(): Promise<MyCourseListItemDto[]> {
  const res = await fetch(`${apiBaseUrl()}/me/courses`, {
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

type PublicCourseDetailDto = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  updatedAt?: string | null; // 新增
  priceCents: number; // 确保有这个
  accessType: 'free' | 'paid'; // 确保有这个
};

type PublicLessonListItemDto = {
  id: string;
  title: string;
  slug: string;
  order: number;
  type: 'video' | 'text';
  isFreePreview: boolean;
};

type PublicLessonDetailDto = {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  order: number;
  type: 'video' | 'text';
  isFreePreview: boolean;
  videoUrl: string | null;
  contentText: string | null;
};

function apiBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  const url = envUrl.trim() ? envUrl.trim() : 'http://localhost:3001';
  return url.replace(/\/+$/, '');
}

async function getCourse(slug: string): Promise<PublicCourseDetailDto> {
  const res = await fetch(`${apiBaseUrl()}/courses/${encodeURIComponent(slug)}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) {
    const err: any = new Error('Failed to load course');
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as PublicCourseDetailDto;
}

async function getLessons(slug: string): Promise<PublicLessonListItemDto[]> {
  const res = await fetch(`${apiBaseUrl()}/courses/${encodeURIComponent(slug)}/lessons`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) {
    const err: any = new Error('Failed to load lessons');
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as PublicLessonListItemDto[];
}

async function getLessonDetail(
  courseSlug: string,
  lessonSlug: string,
): Promise<PublicLessonDetailDto> {
  const res = await fetch(
    `${apiBaseUrl()}/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(
      lessonSlug,
    )}`,
    {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    const err: any = new Error('Failed to load lesson detail');
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as PublicLessonDetailDto;
}

export default function CourseDetailPage() {
  const params = useParams<{ slug: string }>();
  const courseSlug = params.slug;

  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedLessonSlug = searchParams.get('lesson');

  const [course, setCourse] = useState<PublicCourseDetailDto | null>(null);
  const [lessons, setLessons] = useState<PublicLessonListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [lessonDetail, setLessonDetail] = useState<PublicLessonDetailDto | null>(null);
  const [implicitLessonSlug, setImplicitLessonSlug] = useState<string | null>(null);
  const effectiveLessonSlug = selectedLessonSlug ?? implicitLessonSlug;
  const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null);

  const selectedLessonMeta = useMemo(
    () => lessons.find((l) => l.slug === effectiveLessonSlug) ?? null,
    [lessons, effectiveLessonSlug],
  );

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const hasAuth = Boolean(currentUser);
  // [新增] 判断是否管理员
  const isAdmin = currentUser?.role === 'admin';

  // 检查当前用户登录状态
  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const res = await fetch(`${apiBaseUrl()}/auth/me`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (!res.ok) {
          if (!cancelled) setCurrentUser(null);
          return;
        }

        const user = (await res.json()) as AuthUser;
        if (!cancelled) setCurrentUser(user);
      } catch {
        if (!cancelled) setCurrentUser(null);
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // 若已登录：判断当前用户是否已开通本课程
  useEffect(() => {
    let cancelled = false;

    async function loadEnrollment() {
      if (!hasAuth) {
        setIsEnrolled(null);
        return;
      }

      try {
        const myCourses = await getMyCourses();
        if (cancelled) return;

        const enrolled = myCourses.some((c) => c.slug === courseSlug);
        setIsEnrolled(enrolled);
      } catch (e: any) {
        if (!cancelled) setIsEnrolled(null);
      }
    }

    loadEnrollment();

    return () => {
      cancelled = true;
    };
  }, [courseSlug, hasAuth]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [c, ls] = await Promise.all([getCourse(courseSlug), getLessons(courseSlug)]);
        if (cancelled) return;
        setCourse(c);
        setLessons(ls);
        setImplicitLessonSlug(null);
      } catch (err: any) {
        if (cancelled) return;
        const status: number | undefined = err?.status;
        if (status === 404) setError('课程不存在或未发布');
        else setError(err?.message ?? '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [courseSlug]);

  // 自动选中默认课节
  useEffect(() => {
    if (selectedLessonSlug) return;
    if (implicitLessonSlug) return;
    if (!lessons || lessons.length === 0) return;

    const sorted = [...lessons].sort((a, b) => a.order - b.order);
    const defaultLesson = sorted.find((l) => l.isFreePreview) ?? sorted[0];
    setImplicitLessonSlug(defaultLesson.slug);
  }, [implicitLessonSlug, lessons, selectedLessonSlug]);

  useEffect(() => {
    let cancelled = false;

    async function loadLesson() {
      setLessonError(null);
      setLessonDetail(null);

      if (!effectiveLessonSlug) return;

      setLessonLoading(true);

      try {
        const detail = await getLessonDetail(courseSlug, effectiveLessonSlug);

        if (!cancelled) setLessonDetail(detail);
      } catch (err: any) {
        if (cancelled) return;

        const status: number | undefined = err?.status ?? err?.response?.status;
        if (status === 403) setLessonError('该课节需要购买/开通课程后解锁。');
        else if (status === 404) setLessonError('课节不存在或未发布。');
        else setLessonError(err?.message ?? '加载课节失败');
      } finally {
        if (!cancelled) setLessonLoading(false);
      }
    }

    loadLesson();
    return () => {
      cancelled = true;
    };
  }, [courseSlug, effectiveLessonSlug]);

  const handleSelectLesson = (lessonSlug: string) => {
    setImplicitLessonSlug(null);
    router.push(`/courses/${courseSlug}?lesson=${encodeURIComponent(lessonSlug)}`);
  };

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-slate-600">加载中…</div>;
  }

  if (error || !course) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error ?? '加载失败'}
        </div>
        <div className="mt-4">
          <Link
            href="/me"
            className="text-sm font-medium text-blue-700 underline underline-offset-2"
          >
            返回个人中心
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-semibold text-slate-900">{course.title}</h1>
            {/* [新增] 管理员的编辑按钮 */}
            {isAdmin && (
              <Link
                href={`/courses/admin/${course.id}/edit`}
                className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                title="编辑课程"
              >
                <Pencil className="mr-1 h-3 w-3" />
                编辑
              </Link>
            )}
          </div>

          {/* [新增] 时间信息展示 */}
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            {course.publishedAt && (
              <span>发布于 {new Date(course.publishedAt).toLocaleDateString()}</span>
            )}
            {course.updatedAt && (
              <span>最后更新 {new Date(course.updatedAt).toLocaleDateString()}</span>
            )}
          </div>

          {course.summary ? (
            <p className="mt-2 text-sm text-slate-600">{course.summary}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-400">暂无课程简介</p>
          )}
          {course.description ? (
            <p className="mt-2 text-sm text-slate-600">{course.description}</p>
          ) : null}
        </div>

        <div className="shrink-0 space-y-2 text-right">
          {hasAuth ? (
            <Link
              href="/me"
              className="inline-block rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              返回个人中心
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-block rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              去登录
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        {/* 左：课节列表 */}
        <section className="rounded border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">课节列表</h2>
            <span className="text-[11px] text-slate-500">共 {lessons.length} 节</span>
          </div>

          {lessons.length === 0 ? (
            <div className="rounded border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
              该课程暂时没有课节。
            </div>
          ) : (
            <div className="space-y-2">
              {lessons.map((l) => {
                const active = l.slug === effectiveLessonSlug;
                const badgeLabel = l.isFreePreview
                  ? '免费'
                  : hasAuth && isEnrolled === true
                    ? '已购'
                    : '购买';
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleSelectLesson(l.slug)}
                    className={[
                      'w-full rounded border p-3 text-left',
                      active
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{l.title}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {/* [修改] 移除了“免费试看”或“需解锁”字样 */}第 {l.order} 节 ·{' '}
                          {l.type === 'video' ? '视频' : '图文'}
                        </div>
                      </div>
                      <span className="shrink-0 rounded bg-slate-200 px-2 py-1 text-[10px] text-slate-700">
                        {badgeLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* 右：课节内容 */}
        <section className="rounded border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-800">课节内容</h2>
            <p className="mt-1 text-xs text-slate-500">
              选择左侧课节后，将在此处加载内容（已开通用户可解锁付费课节）。
            </p>
          </div>

          {!effectiveLessonSlug ? (
            <div className="rounded border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
              请先从左侧选择一个课节。
            </div>
          ) : lessonLoading ? (
            <div className="rounded border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
              正在加载课节…
            </div>
          ) : lessonError ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {lessonError}

              {selectedLessonMeta?.isFreePreview === false ? (
                <div className="mt-3 space-y-2 text-xs text-amber-700">
                  {!hasAuth ? (
                    <div>
                      你当前未登录：登录后才能解锁已购课节。
                      <div className="mt-2">
                        <Link
                          href="/login"
                          className="inline-block rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                        >
                          去登录
                        </Link>
                      </div>
                    </div>
                  ) : isEnrolled === false ? (
                    <div>
                      你已登录，但该课程尚未为你的账号开通；开通后才能解锁此课节。
                      <div className="mt-2">
                        <Link
                          href="/me"
                          className="inline-block rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                        >
                          前往个人中心
                        </Link>
                      </div>
                      <div className="mt-2 text-[11px] text-amber-700/80">
                        后续我们会在个人中心提供“购买/开通课程”的入口；目前可先通过后台或测试数据为用户开通。
                      </div>
                    </div>
                  ) : (
                    <div>
                      你已登录但仍无法访问：请回到个人中心确认该课程已出现在「我的课程」列表里（已开通）。
                      <div className="mt-2">
                        <Link
                          href="/me"
                          className="inline-block rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                        >
                          前往个人中心
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : lessonDetail ? (
            <div className="space-y-3">
              <div className="rounded border border-slate-100 bg-slate-50 p-3">
                <div className="text-sm font-semibold text-slate-900">{lessonDetail.title}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  第 {lessonDetail.order} 节 · {lessonDetail.type === 'video' ? '视频' : '图文'}
                </div>
              </div>

              {lessonDetail.type === 'text' ? (
                <div className="rounded border border-slate-100 bg-white p-3 text-sm text-slate-800">
                  {lessonDetail.contentText ? lessonDetail.contentText : '（暂无图文内容）'}
                </div>
              ) : (
                <div className="rounded border border-slate-100 bg-white p-3 text-sm text-slate-800">
                  {lessonDetail.videoUrl ? (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-500">视频地址：</div>
                      <a
                        className="break-all text-sm text-blue-700 underline underline-offset-2"
                        href={lessonDetail.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {lessonDetail.videoUrl}
                      </a>
                      <div className="text-xs text-slate-400">
                        后续我们会把这里替换为真正的视频播放器。
                      </div>
                    </div>
                  ) : (
                    '（暂无视频地址）'
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
              未能加载课节内容。
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
