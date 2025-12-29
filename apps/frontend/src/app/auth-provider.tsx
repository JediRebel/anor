// apps/frontend/src/app/auth-provider.tsx
'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '@/lib/api/auth';
import { getSessionUser, logout as logoutSession } from '@/lib/auth/client-auth';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  // 跳转到登录页（cookie 由后端设置）；
  login: () => Promise<void>;
  // 调用后端 /auth/logout 清理会话（httpOnly cookies）
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  // Cookie 模式：客户端无法同步读取 token，只能通过 /auth/me 获取当前会话用户
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const me = await getSessionUser();
      if (!cancelled) setUser(me);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      isAuthenticated: !!user,
      async login() {
        // cookie 登录流程由登录页触发；这里仅负责导航
        router.push('/login');
      },
      async logout() {
        await logoutSession();
        setUser(null);
        router.push('/');
        // 退出后刷新一次路由数据，避免残留的“已登录”视图
        router.refresh();
      },
    };
  }, [router, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider />');
  }
  return ctx;
}
