// apps/backend/src/common/http-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<
      Response & { status?: (code: number) => any }
    >();
    const request = ctx.getRequest<Request>();

    // 默认值：内部错误
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      // 统一从 HttpException.getResponse() 中取 message 字段，没有就用整个 res
      message = (res as any).message ?? res;
    }

    const reqAny = request as any;
    const method = String(reqAny?.method ?? '').toUpperCase();
    // Prefer originalUrl when available (includes query string in Express)
    const path = String(
      reqAny?.originalUrl ?? reqAny?.url ?? request.url ?? '',
    );

    // Detect whether this request "looks like it should have" an auth token.
    // We use this to avoid noisy logs for expected anonymous session probes.
    const hasAuthorization =
      typeof reqAny?.headers?.authorization === 'string' &&
      reqAny.headers.authorization.trim().length > 0;

    // Cookie keys (support both underscore and hyphen variants during migration)
    const ACCESS_COOKIE_KEYS = [
      'anor_at',
      'anor-at',
      'anor_access_token',
      'anor-access-token',
      'anorAccessToken',
      'access_token',
      'access-token',
      'accessToken',
      'at',
    ];

    const REFRESH_COOKIE_KEYS = [
      'anor_rt',
      'anor-rt',
      'anor_refresh_token',
      'anor-refresh-token',
      'anorRefreshToken',
      'refresh_token',
      'refresh-token',
      'refreshToken',
      'rt',
    ];

    function getCookieMap(): Record<string, string> {
      // 1) Prefer cookie-parser populated bag
      const bag = reqAny?.cookies;
      if (bag && typeof bag === 'object') {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(bag)) {
          if (typeof v === 'string') out[k] = v;
        }
        return out;
      }

      // 2) Fallback: parse raw Cookie header into exact keys
      const header = reqAny?.headers?.cookie;
      if (typeof header !== 'string' || header.trim().length === 0) return {};

      const out: Record<string, string> = {};
      for (const part of header.split(';')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const k = trimmed.slice(0, eq).trim();
        const rawVal = trimmed.slice(eq + 1);
        if (!k) continue;
        // Cookies may be URL-encoded
        try {
          out[k] = decodeURIComponent(rawVal);
        } catch {
          out[k] = rawVal;
        }
      }
      return out;
    }

    const cookieMap = getCookieMap();

    const hasAccessCookie = ACCESS_COOKIE_KEYS.some((k) => {
      const v = cookieMap[k];
      return typeof v === 'string' && v.trim().length > 0;
    });

    const hasRefreshCookie = REFRESH_COOKIE_KEYS.some((k) => {
      const v = cookieMap[k];
      return typeof v === 'string' && v.trim().length > 0;
    });

    const hasAnyAuthCookie = hasAccessCookie || hasRefreshCookie;

    const isAuthMePath = path === '/auth/me' || path.startsWith('/auth/me?');
    // Silence the expected anonymous probe:
    // - GET /auth/me is used by frontend to check session.
    // - When user is not logged in, 401 is normal.
    // - IMPORTANT: even if a refresh-token cookie exists, /auth/me still cannot authenticate
    //   (it needs an access token). Treat "refresh-only" as an expected probe and keep it silent.
    // - If Authorization header exists OR an access-token cookie exists, then a 401 is suspicious
    //   and SHOULD be logged.
    const silentAuthProbe401 =
      status === HttpStatus.UNAUTHORIZED &&
      method === 'GET' &&
      isAuthMePath &&
      !hasAuthorization &&
      !hasAccessCookie;

    const errorResponse = {
      success: false,
      statusCode: status,
      path,
      method,
      message,
      timestamp: new Date().toISOString(),
    };

    const logText = `${errorResponse.method} ${errorResponse.path} ${status} - ${JSON.stringify(
      message,
    )}`;

    // 区分 4xx / 5xx 的日志级别：
    // - 4xx：业务 / 参数错误，用 warn（但会对“预期内的匿名 /auth/me 401”静默）
    // - 5xx：系统异常，用 error，并带上 stack
    if (!silentAuthProbe401) {
      if (exception instanceof HttpException) {
        if (status >= 500) {
          this.logger.error(logText, (exception as any).stack);
        } else {
          this.logger.warn(logText);
        }
      } else {
        // 非 HttpException，一律视为系统级错误
        this.logger.error(logText, (exception as any)?.stack);
      }
    }

    (response as any).status(status).json(errorResponse);
  }
}
