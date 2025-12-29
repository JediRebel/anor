// apps/frontend/src/app/articles/[slug]/AdminEditButton.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// ✅ 用 || 而不是 ??，避免 env 存在但为空字符串导致 API_BASE 变成 ''（请求会打到前端域名）
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

type MeResponse = {
  id: number;
  email: string;
  role: 'admin' | 'user';
};

interface AdminEditButtonProps {
  articleId: number;
}

export function AdminEditButton({ articleId }: AdminEditButtonProps) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // ✅ cookie 模式：用后端 /auth/me 判断当前登录用户角色
        const res = await fetch(`${API_BASE}/auth/me`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (!res.ok) {
          if (!cancelled) setIsAdmin(false);
          return;
        }

        const me = (await res.json()) as MeResponse;
        if (!cancelled) setIsAdmin(me?.role === 'admin');
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAdmin) return null;

  return (
    <div className="mt-4">
      <Link
        href={`/articles/admin/${articleId}/edit`}
        className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
      >
        编辑
      </Link>
    </div>
  );
}
