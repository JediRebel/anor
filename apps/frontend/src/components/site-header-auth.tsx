// apps/frontend/src/components/site-header-auth.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/app/auth-provider';
import { useEffect, useState } from 'react';

interface SiteHeaderAuthProps {
  initialUser?: any; // 接收服务器端传入的初始 User (如果有)
}

export function SiteHeaderAuth({ initialUser }: SiteHeaderAuthProps) {
  const { user, loading } = useAuth();
  const [isRecovering, setIsRecovering] = useState(false);

  // 真正的当前用户：优先取 Client 端验证过的 user，没有则取 Server 端传来的 initialUser
  const effectiveUser = user || initialUser;

  useEffect(() => {
    // 这是一个优化体验的逻辑：
    // 如果当前没有用户（initialUser 是 null），但浏览器里有 "login_status" 标记，
    // 说明“记住我”正在生效中，即将自动登录。
    // 此时我们将状态设为 "recovering"，显示加载状态而不是“登录”按钮，避免闪烁。
    if (
      !effectiveUser &&
      typeof document !== 'undefined' &&
      document.cookie.includes('login_status=1')
    ) {
      setIsRecovering(true);
    } else {
      setIsRecovering(false);
    }
  }, [effectiveUser]);

  // 1. 已登录：显示“我的”
  if (effectiveUser) {
    // 这里保留了你原本可能的样式，请根据你的实际 UI 调整 className
    return (
      <Link
        href="/me"
        className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
      >
        我的
      </Link>
    );
  }

  // 2. 正在恢复会话中：显示空白或 Loading，防止出现“登录”按钮闪一下
  if (loading || isRecovering) {
    return <div className="h-5 w-8 animate-pulse rounded bg-slate-200" />;
  }

  // 3. 未登录：显示“登录”
  return (
    <Link
      href="/login"
      className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
    >
      登录
    </Link>
  );
}
