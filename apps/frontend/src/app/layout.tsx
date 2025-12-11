// apps/frontend/src/app/layout.tsx
import { QueryProvider } from "./query-provider";
import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { AuthProvider } from "./auth-provider";

export const metadata: Metadata = {
  title: "Anor 移民服务",
  description: "面向中国用户的加拿大移民资讯、课程与工具平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <div className="flex min-h-screen flex-col">
          {/* 头部区域 */}
          <header className="border-b bg-white">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4">
              <div className="text-lg font-semibold">Anor 移民服务</div>

              <nav className="ml-8 flex items-center gap-4 text-sm text-slate-600">
                <Link href="/">首页</Link>
                <Link href="/articles">资讯</Link>
                <Link href="/courses">课程</Link>
                <Link href="/tools">工具</Link>
                <Link href="/me">我的</Link>
              </nav>

              <div className="ml-auto text-sm text-slate-500">
                {/* Auth 区域占位 */}
              </div>
            </div>
          </header>

          {/* 主体内容区域 */}
          <main className="flex-1">
            <div className="mx-auto w-full max-w-6xl px-4 py-8">
              <QueryProvider>
                <AuthProvider>
                  {children}
                </AuthProvider>
              </QueryProvider>
            </div>
          </main>

          {/* 页脚区域 */}
          <footer className="border-t bg-white">
            <div className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-slate-500">
              © 2025 Anor Immigration. All rights reserved.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}