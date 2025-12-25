// apps/backend/src/modules/auth/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, RequestUserRole } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 从 handler 或 controller 上读取 @Roles() 设置的角色
    const requiredRoles = this.reflector.getAllAndOverride<RequestUserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 没有标 @Roles 的接口，直接放行（只依赖 JwtAuthGuard）
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: RequestUserRole } | undefined;

    // 没有 user 或没有 role，直接拒绝
    if (!user || !user.role) {
      return false;
    }

    // 只要当前用户的角色在要求列表里，就允许访问
    return requiredRoles.includes(user.role);
  }
}
