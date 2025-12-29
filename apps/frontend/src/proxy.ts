// apps/frontend/src/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function hasAuthCookie(req: NextRequest) {
  const at = req.cookies.get('anor_at')?.value;
  return Boolean(at);
}

// 注意：proxy.ts 里必须导出 default 或名为 proxy 的函数
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const authed = hasAuthCookie(req);

  // 1) 未登录访问 /me 或 /me/* -> 跳 /login?redirect=/me（保持 redirect 可读，不做 %2F 编码）
  if (!authed && (pathname === '/me' || pathname.startsWith('/me/'))) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';

    // 只保存 path（不拼接 search），避免出现 /login?redirect=%2Fme 这种编码展示
    // 如果未来需要保留 query，再单独设计编码/解码规则
    loginUrl.search = `?redirect=${pathname}`;

    return NextResponse.redirect(loginUrl);
  }

  // 2) 已登录访问 /login -> 跳 /me
  if (authed && pathname === '/login') {
    const meUrl = req.nextUrl.clone();
    meUrl.pathname = '/me';
    meUrl.search = '';
    return NextResponse.redirect(meUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/me/:path*', '/login'],
};
