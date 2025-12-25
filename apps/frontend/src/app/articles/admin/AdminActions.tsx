'use client';

import React, { useState, useTransition } from 'react';

type ArticleStatus = 'draft' | 'published';

interface ArticleForActions {
  id: number;
  slug: string;
  isPinned: boolean;
  status: ArticleStatus;
}

interface Props {
  article: ArticleForActions;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export default function AdminActions({ article }: Props) {
  const [isPinned, setIsPinned] = useState(article.isPinned);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const disabled = isPending || isDeleting;

  // 切换置顶状态：调用 PUT /admin/articles/:id，只改 isPinned 字段
  const handleTogglePinned = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/articles/${article.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPinned: !isPinned }),
        });

        if (!res.ok) {
          console.error('Failed to toggle pinned:', res.status, res.statusText);
          return;
        }

        setIsPinned((prev) => !prev);
      } catch (err) {
        console.error('Error toggling pinned:', err);
      }
    });
  };

  // 删除文章：调用 DELETE /admin/articles/:id，然后刷新页面
  const handleDelete = () => {
    if (!window.confirm('确定要删除这篇文章吗？该操作不可恢复。')) {
      return;
    }

    startTransition(async () => {
      try {
        setIsDeleting(true);
        const res = await fetch(`${API_BASE_URL}/admin/articles/${article.id}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          console.error('Failed to delete article:', res.status, res.statusText);
          setIsDeleting(false);
          return;
        }

        // 简单粗暴：删除后刷新后台列表
        window.location.reload();
      } catch (err) {
        console.error('Error deleting article:', err);
        setIsDeleting(false);
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {/* 查看前台：保持原来的功能 */}
      <a
        href={`/articles/${article.slug}`}
        className="text-blue-600 hover:text-blue-700"
        target="_blank"
        rel="noreferrer"
      >
        查看前台
      </a>

      {/* 编辑：先放一个占位按钮，将来做编辑页再接上 */}
      <button
        type="button"
        className="text-gray-600 hover:text-gray-800 cursor-not-allowed"
        disabled
        title="编辑功能后续实现"
      >
        编辑
      </button>

      {/* 置顶 / 取消置顶 */}
      <button
        type="button"
        onClick={handleTogglePinned}
        disabled={disabled}
        className="text-amber-600 hover:text-amber-700 disabled:text-amber-300"
      >
        {isPinned ? '取消置顶' : '置顶'}
      </button>

      {/* 删除 */}
      <button
        type="button"
        onClick={handleDelete}
        disabled={disabled}
        className="text-red-600 hover:text-red-700 disabled:text-red-300"
      >
        删除
      </button>
    </div>
  );
}