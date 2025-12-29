// apps/frontend/src/app/me/AdminDashboardSection.tsx
'use client';

import Link from 'next/link';

interface AdminDashboardSectionProps {
  email: string | null;
}

export function AdminDashboardSection({ email }: AdminDashboardSectionProps) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">管理员控制面板</h1>
        <p className="mt-2 text-sm text-gray-600">
          这里是后台总入口。您可以从这里进入文章管理，将来还可以扩展用户管理、课程管理、报表等功能。
        </p>
        {email && (
          <p className="mt-1 text-xs text-gray-500">
            当前管理员账号：<span className="font-medium">{email}</span>
          </p>
        )}
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {/* 文章管理卡片 */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">文章管理</h2>
          <p className="mt-2 text-sm text-gray-600">
            管理移民资讯文章，包括新建、编辑、删除以及置顶、封面图等。
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/articles/admin"
              className="inline-flex items-center rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-800 hover:border-gray-400 hover:bg-gray-50"
            >
              查看文章列表
            </Link>
            <Link
              href="/articles/admin/new"
              className="inline-flex items-center rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              新建文章
            </Link>
          </div>
        </div>

        {/* 课程管理卡片 */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">课程管理</h2>
          <p className="mt-2 text-sm text-gray-600">
            管理课程与课节内容，包括课程信息、课节排序、免费试看设置、发布状态等。
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/courses/admin"
              className="inline-flex items-center rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-800 hover:border-gray-400 hover:bg-gray-50"
            >
              查看课程列表
            </Link>
            <Link
              href="/courses/admin/new"
              className="inline-flex items-center rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              新建课程
            </Link>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            注：若你尚未实现课程后台页面，这两个入口会暂时 404；我们下一步会补齐对应页面。
          </p>
        </div>

        {/* 预留扩展卡片 */}
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5">
          <h2 className="text-base font-semibold text-gray-900">更多后台功能（预留）</h2>
          <p className="mt-2 text-sm text-gray-600">
            将来可以在这里增加：
            <br />
            · 用户管理（查看 / 冻结 / 调整角色）
            <br />· 收费与访问报表（订单统计、课程访问数据）
          </p>
          <p className="mt-2 text-xs text-gray-400">
            当前阶段仅启用文章管理功能，其余模块等业务准备好后再逐步接入。
          </p>
        </div>
      </section>
    </main>
  );
}
