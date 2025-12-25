// apps/frontend/src/app/articles/[slug]/AdminEditButton.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getStoredAuth } from '@/lib/auth/client-auth';

interface AdminEditButtonProps {
  articleId: number;
}

export function AdminEditButton({ articleId }: AdminEditButtonProps) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // 只在客户端检查本地登录信息
    const auth = getStoredAuth();
    if (auth?.user?.role === 'admin') {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
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
