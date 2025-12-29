// apps/backend/src/modules/auth/jwt-auth.guard.ts
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      // 降噪策略：
      // 1) 如果请求里完全没有任何 auth 线索（既没有 Authorization header，也没有 Cookie），
      //    则认为是“匿名访问”，不打印 auth failed。
      // 2) 只有当请求里“看起来应该有 token”（有 Authorization 或 Cookie）但鉴权失败时，才打印 warn。
      const req = context.switchToHttp().getRequest();
      const path = req?.url;

      const authHeader = req?.headers?.authorization;
      const rawCookieHeader = req?.headers?.cookie;

      const hasAuthorization =
        typeof authHeader === 'string' && authHeader.trim().length > 0;

      // Only treat cookies as an auth hint if they include our **access-token** cookies.
      // Important: do NOT treat refresh-token cookies (e.g. `anor_rt`) as an auth hint for /auth/me,
      // otherwise anonymous/expired sessions would produce noisy warnings.
      const ACCESS_COOKIE_CANDIDATES = [
        'anor_at',
        'anor_access_token',
        'anorAccessToken',
        'access_token',
        'accessToken',
        'at',
      ] as const;

      const cookieBag = (req as any)?.cookies;
      const hasAuthCookieBag =
        !!cookieBag &&
        typeof cookieBag === 'object' &&
        ACCESS_COOKIE_CANDIDATES.some((k) => {
          const v = cookieBag[k];
          return typeof v === 'string' && v.trim().length > 0;
        });

      const hasAuthCookieHeader =
        typeof rawCookieHeader === 'string' &&
        rawCookieHeader.trim().length > 0 &&
        (() => {
          // Parse Cookie header and only treat it as an auth hint if our auth cookie exists
          // AND its value is non-empty. This avoids false positives such as `anor_at=`.
          const getCookieValue = (
            header: string,
            name: string,
          ): string | null => {
            for (const part of header.split(';')) {
              const trimmed = part.trim();
              if (!trimmed) continue;
              const eq = trimmed.indexOf('=');
              if (eq <= 0) continue;
              const k = trimmed.slice(0, eq).trim();
              if (k !== name) continue;
              const rawVal = trimmed.slice(eq + 1);
              if (!rawVal) return '';
              try {
                return decodeURIComponent(rawVal);
              } catch {
                return rawVal;
              }
            }
            return null;
          };

          return ACCESS_COOKIE_CANDIDATES.some((k) => {
            const v = getCookieValue(rawCookieHeader, k);
            return typeof v === 'string' && v.trim().length > 0;
          });
        })();

      const hasAnyAuthHint =
        hasAuthorization || hasAuthCookieHeader || hasAuthCookieBag;

      // 只在开发环境打印（且仅在“看起来应该有 token/会话”但失败时打印）
      if (process.env.NODE_ENV !== 'production' && hasAnyAuthHint) {
        // eslint-disable-next-line no-console
        console.warn('[JwtAuthGuard] auth failed', {
          err,
          info,
          hasUser: !!user,
          path,
          hasAuthorization,
          hasCookie: hasAuthCookieHeader || hasAuthCookieBag,
        });
      }

      // 对客户端统一返回 401，不区分“未登录”“过期”等细节
      throw new UnauthorizedException('Unauthorized');
    }

    return user;
  }
}
