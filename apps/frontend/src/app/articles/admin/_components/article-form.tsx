'use client';

import React, { useEffect, useState } from 'react';

export type ArticleStatus = 'draft' | 'published';

export type ArticleFormValues = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  status: ArticleStatus;
  isPinned: boolean;
};

interface ArticleFormProps {
  initialValues?: Partial<ArticleFormValues>;
  onSubmit: (values: ArticleFormValues) => Promise<void> | void;
  submitLabel: string;
  isSubmitting?: boolean;
}

/**
 * 后台文章表单（新建 / 编辑共用）
 */
export function ArticleForm({
  initialValues,
  onSubmit,
  submitLabel,
  isSubmitting = false,
}: ArticleFormProps) {
  const [form, setForm] = useState<ArticleFormValues>({
    title: '',
    slug: '',
    summary: '',
    content: '',
    status: 'draft',
    isPinned: false,
  });

  // 当 initialValues 变化时（编辑页加载完成），同步到表单
  useEffect(() => {
    if (!initialValues) return;
    setForm((prev) => ({
      ...prev,
      ...initialValues,
      status: (initialValues.status as ArticleStatus) ?? prev.status,
      isPinned:
        typeof initialValues.isPinned === 'boolean'
          ? initialValues.isPinned
          : prev.isPinned,
    }));
  }, [initialValues]);

  const handleChange: React.ChangeEventHandler<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  > = (e) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const { name, value, type } = target;
    const checked = (target as HTMLInputElement).checked;

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    await onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 标题 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          标题
        </label>
        <input
          type="text"
          name="title"
          value={form.title}
          onChange={handleChange}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="请输入文章标题"
          required
        />
      </div>

      {/* slug */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Slug（URL 片段）
        </label>
        <input
          type="text"
          name="slug"
          value={form.slug}
          onChange={handleChange}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="例如：ee-2026-policy-overview"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          访问链接会是：/articles/<span className="font-mono">slug</span>
        </p>
      </div>

      {/* 摘要 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          摘要（列表页显示）
        </label>
        <textarea
          name="summary"
          value={form.summary}
          onChange={handleChange}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="简单说明本文在讲什么，1～3 句话即可。"
        />
      </div>

      {/* 正文内容 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          正文内容
        </label>
        <textarea
          name="content"
          value={form.content}
          onChange={handleChange}
          rows={10}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="这里先用纯文本写内容，后面有需要再换成富文本编辑器。"
        />
      </div>

      {/* 状态 + 置顶 */}
      <div className="flex items-center gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            状态
          </label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
          </select>
        </div>

        <label className="mt-5 inline-flex items-center text-sm text-gray-700">
          <input
            type="checkbox"
            name="isPinned"
            checked={form.isPinned}
            onChange={handleChange}
            className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          置顶显示
        </label>
      </div>

      {/* 提交按钮 */}
      <div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? '保存中…' : submitLabel}
        </button>
      </div>
    </form>
  );
}