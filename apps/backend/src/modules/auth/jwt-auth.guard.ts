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
      // 只在开发环境打印详细日志，方便排查 TokenExpiredError 等问题
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[JwtAuthGuard] auth failed', {
          err,
          info,
          hasUser: !!user,
          path: context.switchToHttp().getRequest().url,
        });
      }

      // 对客户端统一返回 401，不区分“未登录”“过期”等细节
      // 具体文案由前端根据 401/403 自己改成
      // 「当前登录状态已失效，请重新登录」之类
      throw new UnauthorizedException('Unauthorized');
    }

    return user;
  }
}
