// apps/frontend/src/app/layout.tsx
import { QueryProvider } from './query-provider';
import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { AuthProvider } from './auth-provider';
import { getCurrentUser } from '@/lib/api/auth';
import { SiteHeaderAuth } from '@/components/site-header-auth';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'Anor 移民服务',
  description: '面向中国用户的加拿大移民资讯、课程与工具平台',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 服务器端获取用户
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    // 忽略错误
  }

  return (
    <html lang="zh-CN">
      {/* [修改]：添加 suppressHydrationWarning 属性 
        这会消除因浏览器插件（如 Grammarly）注入额外属性而导致的 Hydration 报错
      */}
      <body
        className="min-h-screen bg-slate-50 text-slate-900 antialiased"
        suppressHydrationWarning
      >
        <AuthProvider initialUser={user}>
          <div className="flex min-h-screen flex-col">
            {/* 头部区域 */}
            <header className="border-b bg-white sticky top-0 z-50">
              <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4">
                <Link
                  href="/"
                  className="text-lg font-semibold hover:text-blue-600 transition-colors"
                >
                  Anor 移民服务
                </Link>

                <nav className="ml-8 flex items-center gap-6 text-sm font-medium text-slate-600">
                  <Link href="/articles" className="hover:text-blue-600 transition-colors">
                    文章
                  </Link>
                  <Link href="/courses" className="hover:text-blue-600 transition-colors">
                    课程
                  </Link>
                  <Link href="/tools" className="hover:text-blue-600 transition-colors">
                    工具
                  </Link>
                </nav>

                <div className="ml-auto flex items-center gap-4">
                  <SiteHeaderAuth initialUser={user} />
                </div>
              </div>
            </header>

            {/* 主体内容区域 */}
            <main className="flex-1">
              <div className="mx-auto w-full max-w-6xl px-4 py-8">
                <QueryProvider>{children}</QueryProvider>
              </div>
            </main>

            {/* 页脚区域 */}
            <footer className="border-t bg-white">
              <div className="mx-auto w-full max-w-6xl px-4 py-6 text-center text-xs text-slate-500">
                <p>© 2025 Anor Immigration. All rights reserved.</p>
              </div>
            </footer>
          </div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
