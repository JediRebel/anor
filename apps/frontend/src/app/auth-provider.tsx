// apps/frontend/src/app/auth-provider.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

type UserRole = "guest" | "user" | "paid_user" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  // 下面两个只是占位，Phase 4 再真正实现
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: ReactNode }) {
  // 占位用：先全部当成未登录
  const [user] = useState<AuthUser | null>(null);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    async login() {
      // Phase 4：这里会真正调用后端 /auth/login，拿到 token + 用户信息
      console.warn("AuthProvider.login is not implemented yet.");
    },
    async logout() {
      // Phase 4：这里会清理 token、本地存储等
      console.warn("AuthProvider.logout is not implemented yet.");
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider />");
  }
  return ctx;
}