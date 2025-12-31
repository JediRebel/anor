// apps/frontend/src/app/auth-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { getSessionUser } from '@/lib/auth/client-auth';
import type { AuthUser } from '@/lib/api/auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  refresh: () => Promise<void>; // ✅ [新增] 暴露刷新方法
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  setUser: () => {},
  refresh: async () => {}, // 默认空实现
});

export function AuthProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser?: AuthUser | null;
}) {
  // 初始化状态
  const [user, setUser] = useState<AuthUser | null>(initialUser || null);
  // 如果没有传入 initialUser，或者 initialUser 就是 null，我们都先视为 loading，直到客户端二次确认完成
  const [loading, setLoading] = useState(true);

  // ✅ [新增] 提取核心检查逻辑为 refresh 函数，并暴露给外部
  const refresh = useCallback(async () => {
    try {
      // 尝试获取最新用户信息（client-auth 会自动处理 refresh token）
      const sessionUser = await getSessionUser();

      // 核心修复：无论之前是什么状态，以后端返回为准
      // 如果 sessionUser 是 null (401导致)，这里就会设为 null
      setUser(sessionUser);
    } catch (err) {
      console.error('Auth check failed:', err);
      // 核心修复：发生错误（如网络断开、严重鉴权错误），强制登出
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // 页面挂载时执行一次检查
    if (mounted) {
      refresh();
    }

    return () => {
      mounted = false;
    };
  }, [refresh]);

  // ✅ 将 refresh 传递给 Context
  return (
    <AuthContext.Provider value={{ user, loading, setUser, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
