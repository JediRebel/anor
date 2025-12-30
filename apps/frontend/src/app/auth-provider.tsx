// apps/frontend/src/app/auth-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getSessionUser } from '@/lib/auth/client-auth';
import type { AuthUser } from '@/lib/api/auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  setUser: () => {},
});

export function AuthProvider({
  children,
  initialUser, // 接收服务器端传来的初始用户状态
}: {
  children: ReactNode;
  initialUser?: AuthUser | null;
}) {
  // 如果服务器已经拿到用户，初始状态就直接是该用户
  const [user, setUser] = useState<AuthUser | null>(initialUser || null);
  const [loading, setLoading] = useState(!initialUser);

  useEffect(() => {
    // 页面加载时，检查一次最新的会话状态
    // 这会触发 client-auth.ts 里的“自动刷新 Token”逻辑
    async function initAuth() {
      try {
        const sessionUser = await getSessionUser();
        if (sessionUser) {
          setUser(sessionUser);
        } else {
          // 如果尝试刷新后依然没用户，且之前认为是 null，保持 null
          // 如果之前有值（比如过期了），这里可以置空
          if (!initialUser) setUser(null);
        }
      } catch (err) {
        console.error('Auth check failed', err);
      } finally {
        setLoading(false);
      }
    }

    initAuth();
  }, [initialUser]);

  return <AuthContext.Provider value={{ user, loading, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
